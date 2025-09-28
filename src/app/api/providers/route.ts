import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Provider = {
  id: number;
  ruc: string;
  nombre: string;
  tipo_identificacion: string;
  razon_social?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  categoria?: string;
  notas?: string;
  es_activo: boolean;
  es_especial: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const categoria = searchParams.get('categoria');
    const es_activo = searchParams.get('es_activo');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('providers')
      .select('*', { count: 'exact' })
      .order('es_especial', { ascending: false })
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1);

    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    if (es_activo !== null) {
      query = query.eq('es_activo', es_activo === 'true');
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching providers:', error);
      return NextResponse.json(
        { error: 'Error al cargar proveedores' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data as Provider[],
      count: count || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      ruc,
      nombre,
      tipo_identificacion,
      razon_social,
      direccion,
      telefono,
      email,
      categoria,
      notas,
    } = body;

    if (!ruc || !nombre || !tipo_identificacion) {
      return NextResponse.json(
        { error: 'RUC, nombre y tipo de identificación son requeridos' },
        { status: 400 }
      );
    }

    const existingProvider = await supabase
      .from('providers')
      .select('*')
      .eq('ruc', ruc)
      .single();

    if (existingProvider.data) {
      return NextResponse.json(
        {
          error: 'Ya existe un proveedor con este RUC',
          existingProvider: existingProvider.data,
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('providers')
      .insert({
        ruc,
        nombre,
        tipo_identificacion,
        razon_social,
        direccion,
        telefono,
        email,
        categoria,
        notas,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating provider:', error);
      return NextResponse.json(
        { error: 'Error al crear proveedor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data as Provider }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      nombre,
      razon_social,
      direccion,
      telefono,
      email,
      categoria,
      notas,
      es_activo,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de proveedor es requerido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('providers')
      .update({
        nombre,
        razon_social,
        direccion,
        telefono,
        email,
        categoria,
        notas,
        es_activo,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating provider:', error);
      return NextResponse.json(
        { error: 'Error al actualizar proveedor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data as Provider });
  } catch (error) {
    console.error('Error in PUT /api/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de proveedor es requerido' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('providers')
      .update({ es_activo: false })
      .eq('id', parseInt(id));

    if (error) {
      console.error('Error deleting provider:', error);
      return NextResponse.json(
        { error: 'Error al eliminar proveedor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}