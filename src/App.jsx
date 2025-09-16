import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function App() {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [allProductsData, setAllProductsData] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [percentageInput, setPercentageInput] = useState(25)
  const [applyScope, setApplyScope] = useState('selected')
  const [selectedProducts, setSelectedProducts] = useState(new Set())

  // Function to process a single Excel file
  const processExcelFile = (workbook, localName) => {
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Find the header row (assuming it's the 3rd row, index 2)
    const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 'A3:I3' })[0];

    // Extract data starting from the 4th row (index 3)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 'A4' });

    const columnMapping = {
      'Código': 'codigo',
      'Nombre': 'nombre',
      'Stock': 'stock',
      'Costo U.C.': 'costo_unitario',
      'Costo neto': 'costo_neto',
      'Precio de Venta': 'precio_venta',
      'Precio Sugerido': 'precio_sugerido_excel',
      'Porcentaje de Venta': 'porcentaje_venta_excel',
      'Familia': 'categoria'
    };

    const standardizedData = rawData.map(row => {
      const product = { local: localName };
      headerRow.forEach((header, index) => {
        const standardizedHeader = columnMapping[header] || header.toLowerCase().replace(/\s/g, '_');
        product[standardizedHeader] = row[index];
      });

      // Clean and convert data types
      product.codigo = String(product.codigo || '').trim();
      product.nombre = String(product.nombre || '').trim();
      product.stock = parseFloat(product.stock) || 0;
      product.costo_unitario = parseFloat(product.costo_unitario) || 0;
      product.costo_neto = parseFloat(product.costo_neto) || 0;
      product.precio_venta = parseFloat(product.precio_venta) || 0;
      product.categoria = String(product.categoria || '').trim();

      // Calculate current percentage of sale (gain/loss)
      if (product.costo_neto > 0) {
        product.porcentaje_ganancia_actual = ((product.precio_venta - product.costo_neto) / product.costo_neto) * 100;
      } else {
        product.porcentaje_ganancia_actual = 0;
      }

      // Initialize suggested price with current price
      product.precio_sugerido_calculado = product.precio_venta;

      return product;
    }).filter(p => p.codigo && p.nombre);

    return standardizedData;
  };

  const applyFiltersAndSearch = useCallback(() => {
    let filtered = [...allProductsData];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        String(p.codigo).toLowerCase().includes(query) ||
        String(p.nombre).toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.categoria === selectedCategory);
    }

    // Apply stock filter
    if (stockFilter === 'exclude_zero') {
      filtered = filtered.filter(p => p.stock !== 0);
    } else if (stockFilter === 'only_zero') {
      filtered = filtered.filter(p => p.stock === 0);
    } else if (stockFilter === 'only_negative') {
      filtered = filtered.filter(p => p.stock < 0);
    }

    // Group by product code to create comparison view
    const resultsDict = {};
    filtered.forEach(product => {
      const codigo = product.codigo;
      if (!resultsDict[codigo]) {
        resultsDict[codigo] = {
          codigo: codigo,
          nombre: product.nombre,
          categoria: product.categoria,
          locales: {},
          precio_sugerido_calculado: product.precio_sugerido_calculado,
          porcentaje_ganancia_actual: product.porcentaje_ganancia_actual
        };
      }
      resultsDict[codigo].locales[product.local] = {
        stock: product.stock,
        costo_unitario: product.costo_unitario,
        costo_neto: product.costo_neto,
        precio_venta: product.precio_venta,
      };
    });

    setProducts(Object.values(resultsDict));
  }, [allProductsData, searchQuery, selectedCategory, stockFilter]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Por favor selecciona al menos un archivo Excel');
      return;
    }

    setIsLoading(true);
    setUploadStatus(null);
    setAllProductsData([]);
    setProducts([]);
    setCategories([]);
    setSummary(null);
    setSelectedProducts(new Set());

    let combinedData = [];
    const processedLocals = new Set();

    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const localName = file.name.replace(/\.(xlsx|xls)$/i, '');
        const processedFileProducts = processExcelFile(workbook, localName);
        combinedData = combinedData.concat(processedFileProducts);
        processedLocals.add(localName);
      } catch (error) {
        setUploadStatus({ type: 'error', message: `Error procesando ${file.name}: ${error.message}` });
        setIsLoading(false);
        return;
      }
    }

    setAllProductsData(combinedData);

    const uniqueCategories = [...new Set(combinedData.map(p => p.categoria))].filter(Boolean).sort();
    const uniqueLocals = [...processedLocals].sort();

    setCategories(uniqueCategories);
    setSummary({
      total_products: combinedData.length,
      categories: uniqueCategories,
      locals: uniqueLocals,
      files_processed: files.length,
    });

    setUploadStatus({ type: 'success', message: 'Archivos procesados exitosamente' });
    setIsLoading(false);
  };

  const exportToExcel = () => {
    if (products.length === 0) {
      alert('No hay productos para exportar.');
      return;
    }

    const dataForExcel = [];
    const locals = summary ? summary.locals : [];

    let headerRow = ['Código', 'Nombre', 'Categoría'];
    locals.forEach(local => {
      headerRow.push(`${local} Stock`);
      headerRow.push(`${local} Costo`);
      headerRow.push(`${local} Venta`);
    });
    headerRow.push('Porcentaje Ganancia Actual');
    headerRow.push('Precio Sugerido Calculado');
    dataForExcel.push(headerRow);

    products.forEach(product => {
      let row = [
        product.codigo,
        product.nombre,
        product.categoria
      ];
      locals.forEach(local => {
        const localData = product.locales[local];
        if (localData) {
          row.push(localData.stock);
          row.push(localData.costo_neto);
          row.push(localData.precio_venta);
        } else {
          row.push('-', '-', '-');
        }
      });
      row.push(product.porcentaje_ganancia_actual?.toFixed(2) + '%');
      row.push(product.precio_sugerido_calculado?.toFixed(2));
      dataForExcel.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparacion Precios');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, 'comparacion_precios_mejorado.xlsx');
  };

  const applyPercentage = () => {
    const percentage = percentageInput;
    if (isNaN(percentage)) {
      alert('Por favor, ingresa un porcentaje válido.');
      return;
    }

    const updatedAllProductsData = allProductsData.map(p => {
      let shouldApply = false;
      if (applyScope === 'all') {
        shouldApply = true;
      } else if (applyScope === 'category' && selectedCategory !== 'all') {
        shouldApply = p.categoria === selectedCategory;
      } else if (applyScope === 'selected') {
        shouldApply = selectedProducts.has(p.codigo);
      }

      if (shouldApply && p.costo_neto > 0) {
        const newSuggestedPrice = p.costo_neto * (1 + percentage / 100);
        return { ...p, precio_sugerido_calculado: newSuggestedPrice };
      }
      return p;
    });

    setAllProductsData(updatedAllProductsData);
    applyFiltersAndSearch();
  };

  const toggleProductSelection = (codigo) => {
    setSelectedProducts(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(codigo)) {
        newSelected.delete(codigo);
      } else {
        newSelected.add(codigo);
      }
      return newSelected;
    });
  };

  const getGainIndicator = (percentage) => {
    if (percentage >= 30) return { color: 'text-green-600', bg: 'bg-green-50', icon: '📈' };
    if (percentage >= 10) return { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '➖' };
    return { color: 'text-red-600', bg: 'bg-red-50', icon: '📉' };
  };

  const getStockIndicator = (stock) => {
    if (stock > 10) return { color: 'text-green-600', bg: 'bg-green-100' };
    if (stock > 0) return { color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { color: 'text-red-600', bg: 'bg-red-100' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12 fade-in">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold text-gradient">
              Comparador de Precios
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Analiza y compara precios entre múltiples locales para optimizar tu estrategia de precios y maximizar ganancias de manera inteligente
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 slide-up">
            <div className="card-modern hover-lift bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">Total Productos</p>
                  <p className="text-3xl font-bold">{summary.total_products}</p>
                </div>
                <div className="text-4xl">📦</div>
              </div>
            </div>
            
            <div className="card-modern hover-lift bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium mb-1">Locales</p>
                  <p className="text-3xl font-bold">{summary.locals.length}</p>
                </div>
                <div className="text-4xl">🏪</div>
              </div>
            </div>
            
            <div className="card-modern hover-lift bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium mb-1">Categorías</p>
                  <p className="text-3xl font-bold">{summary.categories.length}</p>
                </div>
                <div className="text-4xl">📁</div>
              </div>
            </div>
            
            <div className="card-modern hover-lift bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Archivos</p>
                  <p className="text-3xl font-bold">{summary.files_processed}</p>
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Section */}
        <div className="card-modern mb-8 hover-lift">
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-t-lg p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Cargar Archivos Excel</h2>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-all duration-300 hover:bg-blue-50">
                <div className="text-6xl mb-4">📤</div>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="input-modern mb-4 max-w-md mx-auto block"
                />
                <p className="text-gray-600 text-lg">
                  Arrastra y suelta archivos Excel aquí, o haz clic para seleccionar
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Formatos soportados: .xlsx, .xls
                </p>
              </div>
              
              {files.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 slide-up">
                  <p className="font-medium text-gray-800 mb-3">Archivos seleccionados:</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        📊 {file.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={handleUpload} 
                disabled={isLoading || files.length === 0}
                className="btn-primary w-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="loading-spinner"></div>
                    Procesando archivos...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span>🚀</span>
                    Cargar y Procesar Archivos
                  </div>
                )}
              </button>

              {uploadStatus && (
                <div className={`p-4 rounded-lg slide-up ${
                  uploadStatus.type === 'success' 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span>{uploadStatus.type === 'success' ? '✅' : '❌'}</span>
                    {uploadStatus.message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        {products.length > 0 && (
          <div className="card-modern mb-8 slide-up">
            <div className="bg-gradient-to-r from-gray-50 to-purple-50 rounded-t-lg p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <span>🔍</span>
                Buscar y Filtrar Productos
              </h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buscar producto</label>
                  <input
                    type="text"
                    placeholder="Código o nombre del producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-modern w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="input-modern w-full"
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock</label>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="input-modern w-full"
                  >
                    <option value="all">Todo el stock</option>
                    <option value="exclude_zero">Excluir stock cero</option>
                    <option value="only_zero">Solo stock cero</option>
                    <option value="only_negative">Solo stock negativo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Price Adjustment Tool */}
        {products.length > 0 && (
          <div className="card-modern mb-8 slide-up">
            <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-t-lg p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <span>💰</span>
                Ajuste de Precios
              </h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Porcentaje de ganancia</label>
                  <input
                    type="number"
                    value={percentageInput}
                    onChange={(e) => setPercentageInput(parseFloat(e.target.value))}
                    className="input-modern w-full"
                    placeholder="25"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aplicar a</label>
                  <select
                    value={applyScope}
                    onChange={(e) => setApplyScope(e.target.value)}
                    className="input-modern w-full"
                  >
                    <option value="selected">Productos seleccionados</option>
                    <option value="category">Categoría actual</option>
                    <option value="all">Todos los productos</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <button
                    onClick={applyPercentage}
                    className="btn-primary w-full h-12"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>⚡</span>
                      Aplicar Porcentaje
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        {products.length > 0 && (
          <div className="card-modern mb-8 slide-up">
            <div className="bg-gradient-to-r from-gray-50 to-indigo-50 rounded-t-lg p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <span>📋</span>
                Comparación de Productos ({products.length})
              </h2>
              <button
                onClick={exportToExcel}
                className="btn-primary"
              >
                <span className="flex items-center gap-2">
                  <span>📥</span>
                  Exportar Excel
                </span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(new Set(products.map(p => p.codigo)));
                          } else {
                            setSelectedProducts(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                    {summary?.locals.map(local => (
                      <th key={local} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {local}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ganancia</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Sugerido</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product, index) => {
                    const gainIndicator = getGainIndicator(product.porcentaje_ganancia_actual);
                    return (
                      <tr key={product.codigo} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.codigo)}
                            onChange={() => toggleProductSelection(product.codigo)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.codigo}</div>
                            <div className="text-sm text-gray-500">{product.nombre}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {product.categoria}
                          </span>
                        </td>
                        {summary?.locals.map(local => {
                          const localData = product.locales[local];
                          const stockIndicator = localData ? getStockIndicator(localData.stock) : null;
                          return (
                            <td key={local} className="px-6 py-4 whitespace-nowrap text-sm">
                              {localData ? (
                                <div className="space-y-1">
                                  <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${stockIndicator.color} ${stockIndicator.bg}`}>
                                    Stock: {localData.stock}
                                  </div>
                                  <div className="text-gray-600">Costo: ${localData.costo_neto?.toFixed(2)}</div>
                                  <div className="text-gray-900 font-medium">Venta: ${localData.precio_venta?.toFixed(2)}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gainIndicator.color} ${gainIndicator.bg}`}>
                            <span className="mr-1">{gainIndicator.icon}</span>
                            {product.porcentaje_ganancia_actual?.toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${product.precio_sugerido_calculado?.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-gray-500">
            Comparador de Precios - Optimiza tu estrategia comercial
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
