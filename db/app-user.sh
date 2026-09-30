#!/bin/bash
# Runs once, when the MySQL container initialises its data directory.
# The application user can only read and insert positions: no UPDATE, DELETE,
# DDL, or access to any other table. The MySQL entrypoint sources this file,
# so it must not change shell options.

mysql --user=root --password="${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'%' IDENTIFIED BY '${APP_DB_PASS}';
GRANT SELECT, INSERT ON \`${MYSQL_DATABASE}\`.gps TO '${APP_DB_USER}'@'%';
SQL
