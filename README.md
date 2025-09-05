# Comparador de Precios - Aplicación Web

## Descripción

Aplicación web desarrollada para comparar precios de productos entre múltiples locales, con funcionalidades avanzadas de análisis de porcentajes de ganancia y aplicación de porcentajes de venta sugeridos.

## Características Principales

### ✅ Funcionalidades Básicas
- **Carga múltiple de archivos Excel**: Soporta archivos .xlsx y .xls de diferentes locales
- **Unificación de datos**: Combina información de múltiples locales en una vista comparativa
- **Búsqueda avanzada**: Por código o nombre de producto
- **Filtros inteligentes**: Por categoría y estado de stock (incluye stock = 0 y negativo)
- **Exportación a Excel**: Con todas las columnas de análisis incluidas

### 🆕 Nuevas Funcionalidades de Análisis
- **Cálculo automático de porcentaje de ganancia/pérdida actual**
- **Aplicación de porcentajes de venta sugeridos** con opciones de:
  - Producto individual
  - Categoría completa
  - Selección múltiple de productos
- **Interfaz de selección** con checkboxes para productos específicos
- **Visualización de precios sugeridos calculados**

## Arquitectura Técnica

### Backend (Flask)
- **Tamaño**: Extremadamente ligero (~5MB)
- **Dependencias**: Solo Flask y Flask-CORS
- **Función**: Servidor de archivos estáticos únicamente
- **Compatibilidad**: ✅ Compatible con Vercel y otros servicios serverless

### Frontend (React)
- **Procesamiento**: 100% en el navegador del usuario
- **Librerías principales**: 
  - `xlsx` para lectura de archivos Excel
  - `file-saver` para exportación
  - `shadcn/ui` para componentes de interfaz
- **Ventajas**: Sin limitaciones de tamaño del servidor, procesamiento rápido

## Formato de Archivos Excel Soportado

La aplicación está optimizada para procesar archivos Excel con la siguiente estructura:

### Columnas Esperadas (a partir de la fila 3):
- **Código**: Identificador único del producto
- **Nombre**: Nombre descriptivo del producto  
- **Stock**: Cantidad disponible
- **Costo U.C.**: Costo unitario
- **Costo neto**: Costo neto (generalmente Costo U.C. + IVA)
- **Precio de Venta**: Precio actual de venta
- **Familia**: Categoría del producto

### Cálculos Automáticos:
- **Porcentaje de Ganancia Actual**: `((Precio de Venta - Costo neto) / Costo neto) * 100`
- **Precio Sugerido**: `Costo neto * (1 + Porcentaje Aplicado / 100)`

## Instrucciones de Uso

### 1. Carga de Archivos
1. Haz clic en "Cargar Archivos Excel"
2. Selecciona uno o más archivos .xlsx/.xls de tus locales
3. Haz clic en "Cargar y Procesar Archivos"

### 2. Búsqueda y Filtros
- **Buscar**: Ingresa código o nombre del producto
- **Categoría**: Selecciona una familia específica o "Todas"
- **Stock**: Filtra por estado de inventario

### 3. Análisis de Porcentajes
1. Ingresa el porcentaje deseado (ej: 25 para 25%)
2. Selecciona el ámbito de aplicación:
   - **Productos seleccionados**: Marca los productos con checkbox
   - **Categoría actual**: Aplica a todos los productos de la categoría filtrada
   - **Todos los productos**: Aplica a toda la base de datos cargada
3. Haz clic en "Aplicar Porcentaje"

### 4. Exportación
- Haz clic en "Exportar a Excel" para descargar los resultados
- El archivo incluye todas las columnas originales más:
  - Porcentaje de ganancia actual
  - Precio sugerido calculado

## Despliegue en Vercel

### Preparación
1. Sube el código a tu repositorio de GitHub
2. Conecta tu repositorio a Vercel
3. Vercel detectará automáticamente la configuración

### Configuración Recomendada en Vercel
- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: Se detecta automáticamente
- **Output Directory**: `src/static`

## Ventajas de la Nueva Arquitectura

### ✅ Compatibilidad con Vercel
- Backend ligero que cumple con el límite de 250MB
- Sin dependencias pesadas como pandas o reportlab
- Despliegue rápido y confiable

### ✅ Rendimiento Optimizado
- Procesamiento en el navegador del usuario
- Sin latencia de red para cálculos
- Experiencia de usuario más fluida

### ✅ Privacidad de Datos
- Los archivos Excel nunca salen del navegador del usuario
- Procesamiento completamente local
- Mayor seguridad de la información sensible

## Soporte Técnico

### Requisitos del Navegador
- Navegadores modernos con soporte para ES6+
- JavaScript habilitado
- Mínimo 4GB de RAM para archivos Excel grandes (>10,000 productos)

### Limitaciones
- Archivos Excel extremadamente grandes (>100MB) pueden ser lentos de procesar
- Requiere conexión a internet solo para la carga inicial de la aplicación

## Archivos del Proyecto

- `src/main.py`: Servidor Flask simplificado
- `src/static/`: Archivos del frontend construido
- `requirements.txt`: Dependencias mínimas del backend
- `vercel.json`: Configuración para despliegue en Vercel

## Historial de Versiones

### v2.0 (Actual)
- ✅ Toda la lógica movida al frontend
- ✅ Análisis de porcentajes de ganancia
- ✅ Aplicación de porcentajes sugeridos
- ✅ Compatible con Vercel
- ✅ Backend extremadamente ligero

### v1.0 (Anterior)
- ❌ Backend con pandas (incompatible con Vercel)
- ✅ Funcionalidades básicas de comparación
- ✅ Exportación a Excel y PDF

---

**Desarrollado con ❤️ para optimizar la gestión de precios entre múltiples locales**

