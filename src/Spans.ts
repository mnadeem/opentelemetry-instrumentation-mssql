/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SpanAttributes } from '@opentelemetry/api';
import {
  DatabaseAttribute,
  GeneralAttribute,
} from '@opentelemetry/semantic-conventions';
import type {
  config,
} from 'mssql';

/**
 * Get an Attributes map from a mysql connection config object
 *
 * @param config ConnectionConfig
 */
export function getConnectionAttributes(
  config: config
): SpanAttributes {
  const { server, port, database, user } = getConfig(config);

  return {
    [GeneralAttribute.NET_PEER_HOSTNAME]: server,
    [GeneralAttribute.NET_PEER_PORT]: port,
    [GeneralAttribute.NET_PEER_ADDRESS]: getJDBCString(server, port, database),
    [DatabaseAttribute.DB_NAME]: database,
    [DatabaseAttribute.DB_USER]: user,
  };
}

function getConfig(config: any) {
  const { server, port, database, user } =
    (config && config.connectionConfig) || config || {};
  return { server, port, database, user };
}

function getJDBCString(
  server: string | undefined,
  port: number | undefined,
  database: string | undefined
) {
  let jdbcString = `jdbc:mysql://${server || 'localhost'}`;

  if (typeof port === 'number') {
    jdbcString += `:${port}`;
  }

  if (typeof database === 'string') {
    jdbcString += `/${database}`;
  }

  return jdbcString;
}

/**
 * The span name SHOULD be set to a low cardinality value
 * representing the statement executed on the database.
 *
 * @returns SQL statement without variable arguments or SQL verb
 */
export function getSpanName(query: string | TemplateStringsArray): string {
  if (typeof query === 'object') {
    return query[0];
  }
  return query.split(' ')[0];
}
