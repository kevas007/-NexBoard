/**
 * Utilitaires pour exporter des données en CSV, JSON, etc.
 */

/**
 * Exporte des données en CSV
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: Record<keyof T, string>
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Utiliser les headers fournis ou les clés des objets
  const keys = Object.keys(data[0]) as (keyof T)[];
  const headerLabels = keys.map(key => headers?.[key] || String(key));

  // Créer les lignes CSV
  const csvRows: string[] = [];

  // En-tête
  csvRows.push(headerLabels.join(','));

  // Données
  data.forEach(item => {
    const values = keys.map(key => {
      const value = item[key];
      // Échapper les valeurs contenant des virgules ou des guillemets
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    });
    csvRows.push(values.join(','));
  });

  // Créer le blob et télécharger
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporte des données en JSON
 */
export function exportToJSON<T>(data: T[], filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporte des données en Excel (format CSV avec extension .xlsx simulé)
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: Record<keyof T, string>
): void {
  // Pour l'instant, on utilise CSV (Excel peut ouvrir les CSV)
  exportToCSV(data, filename, headers);
}

