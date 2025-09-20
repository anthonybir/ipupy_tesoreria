const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {throw new Error('Token no proporcionado');}

  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const decoded = verifyToken(req);

    switch (req.method) {
    case 'GET':
      return await handleGet(req, res, decoded);
    case 'POST':
      return await handlePost(req, res, decoded);
    case 'PUT':
      return await handlePut(req, res, decoded);
    case 'DELETE':
      return await handleDelete(req, res, decoded);
    default:
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API church-transaction-categories:', error);
    if (error.name === 'JsonWebTokenError' || error.message.includes('Token')) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

async function handleGet(req, res) {
  const { category_type, include_inactive } = req.query;
  const showInactive = include_inactive === 'true' || include_inactive === '1';

  const params = [];
  let paramIndex = 1;

  let queryText = `
    SELECT
      ctc.*,
      pc.category_name as parent_category_name
    FROM church_transaction_categories ctc
    LEFT JOIN church_transaction_categories pc ON ctc.parent_category_id = pc.id
    WHERE 1 = 1
  `;

  if (category_type) {
    queryText += ` AND ctc.category_type = $${paramIndex}`;
    params.push(category_type);
    paramIndex++;
  }

  if (!showInactive) {
    queryText += ' AND ctc.is_active = true';
  }

  queryText += ' ORDER BY ctc.category_type, ctc.category_name';

  const result = await execute(queryText, params);

  // Organizar en estructura jerárquica
  const categories = result.rows;
  const categoriesMap = {};
  const rootCategories = [];

  // Crear mapa de categorías
  categories.forEach(cat => {
    categoriesMap[cat.id] = {
      ...cat,
      subcategories: []
    };
  });

  // Organizar jerarquía
  categories.forEach(cat => {
    if (cat.parent_category_id) {
      // Es una subcategoría
      if (categoriesMap[cat.parent_category_id]) {
        categoriesMap[cat.parent_category_id].subcategories.push(categoriesMap[cat.id]);
      }
    } else {
      // Es categoría raíz
      rootCategories.push(categoriesMap[cat.id]);
    }
  });

  res.json({
    categories: rootCategories,
    all_categories: categories // Versión plana para uso directo
  });
}

async function handlePost(req, res, decoded) {
  const data = req.body;

  // Solo admins pueden crear nuevas categorías
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden crear categorías' });
  }

  // Validación básica
  if (!data.category_name || !data.category_type) {
    return res.status(400).json({
      error: 'category_name y category_type son requeridos'
    });
  }

  // Validar tipos permitidos
  const allowedTypes = ['income', 'expense'];
  if (!allowedTypes.includes(data.category_type)) {
    return res.status(400).json({
      error: `category_type debe ser uno de: ${allowedTypes.join(', ')}`
    });
  }

  try {
    // Verificar que no exista una categoría con el mismo nombre
    const existingCategory = await execute(
      'SELECT id FROM church_transaction_categories WHERE category_name = $1',
      [data.category_name]
    );

    if (existingCategory.rows.length > 0) {
      return res.status(400).json({
        error: 'Ya existe una categoría con ese nombre'
      });
    }

    // Si tiene categoría padre, verificar que existe y es del mismo tipo
    const parentCategoryId = data.parent_category_id ? parseInt(data.parent_category_id, 10) : null;

    if (parentCategoryId) {
      const parentCategory = await execute(
        'SELECT * FROM church_transaction_categories WHERE id = $1',
        [parentCategoryId]
      );

      if (parentCategory.rows.length === 0) {
        return res.status(400).json({ error: 'Categoría padre no encontrada' });
      }

      if (parentCategory.rows[0].category_type !== data.category_type) {
        return res.status(400).json({
          error: 'La categoría padre debe ser del mismo tipo'
        });
      }
    }

    // Crear la categoría
    const result = await execute(`
      INSERT INTO church_transaction_categories (
        category_name, category_type, parent_category_id, is_system,
        description, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      data.category_name,
      data.category_type,
      parentCategoryId,
      false,
      data.description || '',
      data.is_active === undefined ? true : Boolean(data.is_active)
    ]);

    res.status(201).json({
      id: result.rows[0].id,
      message: 'Categoría creada exitosamente',
      category: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        error: 'Ya existe una categoría con ese nombre'
      });
    }
    console.error('Error creando categoría:', error);
    res.status(500).json({ error: 'No se pudo crear la categoría' });
  }
}

async function handlePut(req, res, decoded) {
  const { id } = req.query;
  const data = req.body;

  // Solo admins pueden modificar categorías
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden modificar categorías' });
  }

  if (!id) {
    return res.status(400).json({ error: 'ID de categoría requerido' });
  }

  const categoryId = parseInt(id, 10);

  const existingCategory = await execute(
    'SELECT * FROM church_transaction_categories WHERE id = $1', [categoryId]
  );

  if (existingCategory.rows.length === 0) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  const category = existingCategory.rows[0];

  // No permitir modificar categorías del sistema (solo descripción y estado activo)
  if (category.is_system && (data.category_name || data.category_type || data.parent_category_id)) {
    return res.status(400).json({
      error: 'Solo se puede modificar descripción y estado activo de categorías del sistema'
    });
  }

  try {
    const updates = [];
    const params = [];

    if (data.category_name !== undefined && !category.is_system) {
      updates.push(`category_name = $${params.length + 1}`);
      params.push(data.category_name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${params.length + 1}`);
      params.push(data.description);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${params.length + 1}`);
      params.push(Boolean(data.is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(categoryId);

    const result = await execute(`
      UPDATE church_transaction_categories SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    res.json({
      message: 'Categoría actualizada exitosamente',
      category: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        error: 'Ya existe una categoría con ese nombre'
      });
    }
    console.error('Error actualizando categoría:', error);
    res.status(500).json({ error: 'No se pudo actualizar la categoría' });
  }
}

async function handleDelete(req, res, decoded) {
  const { id } = req.query;

  // Solo admins pueden eliminar categorías
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden eliminar categorías' });
  }

  if (!id) {
    return res.status(400).json({ error: 'ID de categoría requerido' });
  }

  const categoryId = parseInt(id, 10);

  const existingCategory = await execute(
    'SELECT * FROM church_transaction_categories WHERE id = $1', [categoryId]
  );

  if (existingCategory.rows.length === 0) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  const category = existingCategory.rows[0];

  // No permitir eliminar categorías del sistema
  if (category.is_system) {
    return res.status(400).json({
      error: 'No se pueden eliminar categorías del sistema'
    });
  }

  try {
    const transactions = await execute(
      'SELECT COUNT(*) as count FROM church_transactions WHERE category_id = $1',
      [categoryId]
    );

    if (Number(transactions.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la categoría porque tiene transacciones asociadas'
      });
    }

    const subcategories = await execute(
      'SELECT COUNT(*) as count FROM church_transaction_categories WHERE parent_category_id = $1',
      [categoryId]
    );

    if (Number(subcategories.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la categoría porque tiene subcategorías'
      });
    }

    const result = await execute(
      'DELETE FROM church_transaction_categories WHERE id = $1 RETURNING *',
      [categoryId]
    );

    res.json({
      message: 'Categoría eliminada exitosamente',
      category: result.rows[0]
    });

  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({ error: 'No se pudo eliminar la categoría' });
  }
}