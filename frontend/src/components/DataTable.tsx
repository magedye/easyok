import React from 'react';

// DataTable renders rows of data in a simple HTML table. It expects an array of objects,
// and dynamically infers the columns from the keys of the first row.
export default function DataTable({ rows }: { rows: Array<Record<string, any>> }) {
  if (!rows || rows.length === 0) {
    return <p>No data available.</p>;
  }
  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-1 text-left font-medium text-gray-700"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {columns.map((col) => (
                <td key={col} className="px-2 py-1 whitespace-nowrap">
                  {String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}