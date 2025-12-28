import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/shared/Card'
import { Input } from '@/components/shared/Input'
import { Spinner } from '@/components/loading/Spinner'
import { getDatabaseSchema } from '@/services/adminService'
import type { DatabaseSchemaResponse, DatabaseTable, DatabaseColumn } from '@/types'

export const SchemaPage = () => {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.dir() === 'rtl'
  const [search, setSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(null)

  const { data: schema, isLoading } = useQuery<DatabaseSchemaResponse>({
    queryKey: ['database-schema'],
    queryFn: getDatabaseSchema,
  })

  const tables: DatabaseTable[] = schema?.tables || []

  const filteredTables = tables.filter((table: DatabaseTable) =>
    table.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={clsx('space-y-6', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          {t('schema.title') || 'Schema & Policy'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          {t('schema.subtitle') || 'Browse allowed tables and columns (display only)'}
        </p>
      </div>

      <Card>
        <Input
          label={t('schema.search') || 'Search Tables'}
          placeholder={t('schema.searchPlaceholder') || 'Type to search tables...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {/* Schema Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tables.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">
              No schema data available
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card title="Tables" description={`${filteredTables.length} tables found`}>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTables.map((table: DatabaseTable) => (
                  <div
                    key={table.name}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      selectedTable?.name === table.name
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900/50'
                        : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    onClick={() => setSelectedTable(table)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {table.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {table.columns?.length || 0} columns
                        </p>
                      </div>
                      {table.rowCount !== undefined && (
                        <span className="text-xs px-2 py-1 bg-neutral-200 dark:bg-neutral-700 rounded">
                          {table.rowCount.toLocaleString()} rows
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {filteredTables.length === 0 && (
                  <p className="text-sm text-neutral-500 text-center py-4">
                    No tables match your search
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedTable ? (
              <Card 
                title={selectedTable.name} 
                description={`${selectedTable.columns?.length || 0} columns`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 dark:bg-neutral-800">
                      <tr>
                        <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                          Column Name
                        </th>
                        <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                          Data Type
                        </th>
                        <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                          Nullable
                        </th>
                        <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                          Constraints
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTable.columns?.map((column: DatabaseColumn) => (
                        <tr 
                          key={column.name} 
                          className="border-t border-neutral-200 dark:border-neutral-700"
                        >
                          <td className="py-3 px-4 text-sm font-mono text-neutral-900 dark:text-white">
                            {column.name}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                              {column.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              column.nullable
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            }`}>
                              {column.nullable ? 'Nullable' : 'NOT NULL'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="flex gap-1">
                              {column.primaryKey && (
                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                                  PK
                                </span>
                              )}
                              {column.foreignKey && (
                                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                                  FK → {column.foreignKey.table}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="text-center py-12">
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Select a table to view its details
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
