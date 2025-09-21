/**
 * Secure SQL Query Builder for IPU PY Tesorería
 * Prevents SQL injection through dynamic query construction
 * All field names and operations are validated against whitelists
 */

class SecureQueryBuilder {
  constructor() {
    // Whitelist of allowed table names
    this.allowedTables = new Set([
      'users', 'churches', 'reports', 'funds', 'transactions',
      'church_accounts', 'church_transactions', 'church_transaction_categories',
      'fund_movements_enhanced', 'fund_categories'
    ]);

    // Whitelist of allowed columns for each table
    this.allowedColumns = {
      funds: new Set([
        'id', 'name', 'type', 'description', 'current_balance',
        'created_at', 'updated_at'
      ]),
      transactions: new Set([
        'id', 'date', 'church_id', 'report_id', 'fund_id', 'concept',
        'provider', 'document_number', 'amount_in', 'amount_out',
        'balance', 'created_by', 'created_at', 'updated_at'
      ]),
      church_transactions: new Set([
        'id', 'church_id', 'account_id', 'transaction_date', 'amount',
        'transaction_type', 'category_id', 'description', 'reference_number',
        'check_number', 'vendor_customer', 'worship_record_id',
        'expense_record_id', 'report_id', 'transfer_account_id',
        'is_reconciled', 'reconciled_date', 'created_by', 'created_at', 'updated_at'
      ]),
      church_accounts: new Set([
        'id', 'church_id', 'account_name', 'account_type', 'account_number',
        'bank_name', 'opening_balance', 'current_balance', 'is_active',
        'created_at', 'updated_at'
      ]),
      reports: new Set([
        'id', 'church_id', 'month', 'year', 'diezmos', 'ofrendas',
        'total_entradas', 'fondo_nacional', 'created_at', 'updated_at'
      ])
    };

    // Allowed comparison operators
    this.allowedOperators = new Set([
      '=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IN', 'NOT IN',
      'IS NULL', 'IS NOT NULL', 'BETWEEN'
    ]);

    // Allowed logical operators
    this.allowedLogicalOperators = new Set(['AND', 'OR']);

    // Allowed order directions
    this.allowedOrderDirections = new Set(['ASC', 'DESC']);
  }

  /**
   * Validates table name against whitelist
   * @param {string} tableName - Table name to validate
   * @throws {Error} If table name is not allowed
   */
  validateTableName(tableName) {
    if (!this.allowedTables.has(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
  }

  /**
   * Validates column name against table-specific whitelist
   * @param {string} tableName - Table name
   * @param {string} columnName - Column name to validate
   * @throws {Error} If column name is not allowed for the table
   */
  validateColumnName(tableName, columnName) {
    this.validateTableName(tableName);

    const allowedCols = this.allowedColumns[tableName];
    if (!allowedCols || !allowedCols.has(columnName)) {
      throw new Error(`Invalid column ${columnName} for table ${tableName}`);
    }
  }

  /**
   * Validates operator against whitelist
   * @param {string} operator - Operator to validate
   * @throws {Error} If operator is not allowed
   */
  validateOperator(operator) {
    const upperOp = operator.toUpperCase();
    if (!this.allowedOperators.has(upperOp)) {
      throw new Error(`Invalid operator: ${operator}`);
    }
    return upperOp;
  }

  /**
   * Builds a secure UPDATE query with parameterized values
   * @param {string} tableName - Table to update
   * @param {Object} updates - Object with column: value pairs
   * @param {Object} where - WHERE conditions
   * @returns {Object} Query object with sql and params
   */
  buildUpdate(tableName, updates, where) {
    this.validateTableName(tableName);

    const updateFields = [];
    const params = [];

    // Validate and build SET clause
    for (const [column, value] of Object.entries(updates)) {
      this.validateColumnName(tableName, column);
      params.push(value);
      updateFields.push(`${column} = $${params.length}`);
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Build WHERE clause
    const whereClause = this.buildWhereClause(tableName, where, params);

    const sql = `
      UPDATE ${tableName}
      SET ${updateFields.join(', ')}, updated_at = NOW()
      ${whereClause.clause}
      RETURNING *
    `;

    return {
      sql: sql.trim(),
      params: whereClause.params
    };
  }

  /**
   * Builds a secure SELECT query with parameterized conditions
   * @param {string} tableName - Table to select from
   * @param {Object} options - Query options
   * @returns {Object} Query object with sql and params
   */
  buildSelect(tableName, options = {}) {
    this.validateTableName(tableName);

    const {
      columns = ['*'],
      where = {},
      orderBy = {},
      limit,
      offset,
      joins = []
    } = options;

    // Validate columns if not using *
    if (columns[0] !== '*') {
      columns.forEach(col => {
        // Handle aliased columns (table.column AS alias)
        const cleanCol = col.split(' ')[0].split('.').pop();
        this.validateColumnName(tableName, cleanCol);
      });
    }

    const params = [];

    // Build SELECT clause
    const selectClause = columns.join(', ');

    // Build FROM clause with joins
    let fromClause = tableName;
    for (const join of joins) {
      this.validateJoin(join);
      fromClause += ` ${join.type} ${join.table} ON ${join.condition}`;
    }

    // Build WHERE clause
    const whereClause = this.buildWhereClause(tableName, where, params);

    // Build ORDER BY clause
    const orderClause = this.buildOrderByClause(tableName, orderBy);

    // Build LIMIT/OFFSET clause
    const limitClause = this.buildLimitClause(limit, offset, params);

    const sql = `
      SELECT ${selectClause}
      FROM ${fromClause}
      ${whereClause.clause}
      ${orderClause}
      ${limitClause}
    `.trim();

    return {
      sql,
      params: whereClause.params
    };
  }

  /**
   * Builds a secure WHERE clause
   * @param {string} tableName - Table name for column validation
   * @param {Object} conditions - WHERE conditions
   * @param {Array} params - Existing parameters array
   * @returns {Object} Object with clause string and updated params
   */
  buildWhereClause(tableName, conditions, params = []) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { clause: '', params };
    }

    const whereConditions = [];

    for (const [column, condition] of Object.entries(conditions)) {
      this.validateColumnName(tableName, column);

      if (typeof condition === 'object' && condition !== null) {
        // Handle operators like { operator: '>=', value: 100 }
        const { operator = '=', value } = condition;
        const validOp = this.validateOperator(operator);

        if (validOp === 'BETWEEN') {
          if (!Array.isArray(value) || value.length !== 2) {
            throw new Error('BETWEEN operator requires array with 2 values');
          }
          params.push(value[0], value[1]);
          whereConditions.push(`${column} BETWEEN $${params.length - 1} AND $${params.length}`);
        } else if (validOp === 'IN' || validOp === 'NOT IN') {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error(`${validOp} operator requires non-empty array`);
          }
          const placeholders = value.map(() => {
            params.push(value[params.length - params.indexOf(value[0])]);
            return `$${params.length}`;
          });
          whereConditions.push(`${column} ${validOp} (${placeholders.join(', ')})`);
        } else if (validOp === 'IS NULL' || validOp === 'IS NOT NULL') {
          whereConditions.push(`${column} ${validOp}`);
        } else {
          params.push(value);
          whereConditions.push(`${column} ${validOp} $${params.length}`);
        }
      } else {
        // Simple equality condition
        params.push(condition);
        whereConditions.push(`${column} = $${params.length}`);
      }
    }

    return {
      clause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Builds a secure ORDER BY clause
   * @param {string} tableName - Table name for column validation
   * @param {Object} orderBy - Order specifications
   * @returns {string} ORDER BY clause
   */
  buildOrderByClause(tableName, orderBy) {
    if (!orderBy || Object.keys(orderBy).length === 0) {
      return '';
    }

    const orderItems = [];

    for (const [column, direction] of Object.entries(orderBy)) {
      this.validateColumnName(tableName, column);

      const upperDirection = direction.toUpperCase();
      if (!this.allowedOrderDirections.has(upperDirection)) {
        throw new Error(`Invalid order direction: ${direction}`);
      }

      orderItems.push(`${column} ${upperDirection}`);
    }

    return orderItems.length > 0 ? `ORDER BY ${orderItems.join(', ')}` : '';
  }

  /**
   * Builds LIMIT and OFFSET clause
   * @param {number} limit - Limit value
   * @param {number} offset - Offset value
   * @param {Array} params - Parameters array
   * @returns {string} LIMIT/OFFSET clause
   */
  buildLimitClause(limit, offset, params) {
    let clause = '';

    if (typeof limit === 'number' && limit > 0) {
      params.push(Math.min(limit, 1000)); // Cap at 1000 for security
      clause += `LIMIT $${params.length}`;

      if (typeof offset === 'number' && offset >= 0) {
        params.push(offset);
        clause += ` OFFSET $${params.length}`;
      }
    }

    return clause;
  }

  /**
   * Validates JOIN specification
   * @param {Object} join - Join specification
   * @throws {Error} If join is invalid
   */
  validateJoin(join) {
    const allowedJoinTypes = ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'];

    if (!join.type || !allowedJoinTypes.includes(join.type.toUpperCase())) {
      throw new Error(`Invalid join type: ${join.type}`);
    }

    if (!join.table || !this.allowedTables.has(join.table)) {
      throw new Error(`Invalid join table: ${join.table}`);
    }

    if (!join.condition || typeof join.condition !== 'string') {
      throw new Error('Join condition is required and must be a string');
    }

    // Basic validation of join condition format (table.column = table.column)
    if (!/^\w+\.\w+\s*=\s*\w+\.\w+$/.test(join.condition.trim())) {
      throw new Error('Invalid join condition format');
    }
  }

  /**
   * Builds a secure INSERT query
   * @param {string} tableName - Table to insert into
   * @param {Object} data - Data to insert
   * @returns {Object} Query object with sql and params
   */
  buildInsert(tableName, data) {
    this.validateTableName(tableName);

    const columns = [];
    const params = [];
    const placeholders = [];

    for (const [column, value] of Object.entries(data)) {
      this.validateColumnName(tableName, column);
      columns.push(column);
      params.push(value);
      placeholders.push(`$${params.length}`);
    }

    if (columns.length === 0) {
      throw new Error('No valid columns to insert');
    }

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    return {
      sql: sql.trim(),
      params
    };
  }
}

// Create singleton instance
const queryBuilder = new SecureQueryBuilder();

module.exports = {
  SecureQueryBuilder,
  queryBuilder
};