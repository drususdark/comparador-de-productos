# Instrucciones de Despliegue - Comparador de Precios

## 🎯 Opciones de Despliegue

### Opción 1: Despliegue en Vercel (Recomendado)

Vercel es ideal para aplicaciones Flask y ofrece despliegue gratuito.

#### Pasos:
1. **Subir a GitHub**:
   ```bash
   cd comparador-precios
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/comparador-precios.git
   git push -u origin main
   ```

2. **Configurar Vercel**:
   - Ve a [vercel.com](https://vercel.com)
   - Conecta tu cuenta de GitHub
   - Importa el repositorio `comparador-precios`
   - Vercel detectará automáticamente que es una aplicación Flask

3. **Configuración Automática**:
   - Vercel usará el archivo `requirements.txt`
   - El punto de entrada será `src/main.py`
   - El frontend ya está integrado en `/src/static/`

#### Archivo vercel.json (ya incluido):
```json
{
  "builds": [
    {
      "src": "src/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/main.py"
    }
  ]
}
```

### Opción 2: Despliegue en Heroku

#### Pasos:
1. **Instalar Heroku CLI**
2. **Crear aplicación**:
   ```bash
   heroku create tu-app-name
   ```
3. **Configurar archivos**:
   - `Procfile`: `web: python src/main.py`
   - `runtime.txt`: `python-3.11.0`
4. **Desplegar**:
   ```bash
   git push heroku main
   ```

### Opción 3: Servidor VPS/Cloud

#### Requisitos:
- Ubuntu 20.04+ o similar
- Python 3.11+
- Nginx (opcional, recomendado)

#### Pasos:
1. **Clonar repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/comparador-precios.git
   cd comparador-precios
   ```

2. **Configurar entorno**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Usar Gunicorn para producción**:
   ```bash
   pip install gunicorn
   gunicorn --bind 0.0.0.0:8000 src.main:app
   ```

4. **Configurar Nginx** (opcional):
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com;
       
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🔧 Configuraciones Importantes

### Variables de Entorno
```bash
# Para producción, cambia la SECRET_KEY
export SECRET_KEY="tu-clave-secreta-segura"
export FLASK_ENV="production"
```

### Límites de Archivo
El límite actual es 16MB. Para cambiarlo, modifica en `main.py`:
```python
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB
```

### CORS en Producción
Para producción, restringe CORS en `main.py`:
```python
CORS(app, origins=["https://tu-dominio.com"])
```

## 📋 Checklist Pre-Despliegue

- [ ] Todos los archivos están en el repositorio
- [ ] `requirements.txt` está actualizado
- [ ] El frontend está construido en `/src/static/`
- [ ] Las variables de entorno están configuradas
- [ ] Los límites de archivo son apropiados
- [ ] CORS está configurado correctamente

## 🧪 Pruebas Post-Despliegue

1. **Verificar carga de página**: La aplicación debe cargar correctamente
2. **Probar carga de archivos**: Sube un archivo Excel de prueba
3. **Verificar búsqueda**: Busca productos por código/nombre
4. **Probar filtros**: Aplica filtros de categoría y stock
5. **Verificar exportación**: Descarga archivos Excel y PDF

## 🚨 Solución de Problemas Comunes

### Error 500 - Internal Server Error
- Revisa los logs del servidor
- Verifica que todas las dependencias estén instaladas
- Comprueba las variables de entorno

### Archivos no se cargan
- Verifica el límite de tamaño de archivo
- Comprueba los permisos del directorio temporal
- Revisa que el tipo MIME esté permitido

### Frontend no carga
- Verifica que los archivos estén en `/src/static/`
- Comprueba que `index.html` existe
- Revisa las rutas en Flask

### CORS Errors
- Verifica la configuración de CORS
- Comprueba que el origen esté permitido
- Revisa que las cabeceras estén configuradas

## 📞 Soporte Técnico

Si encuentras problemas durante el despliegue:

1. **Revisa los logs** del servidor/plataforma
2. **Verifica la configuración** de archivos
3. **Comprueba las dependencias** en requirements.txt
4. **Prueba localmente** antes de desplegar

## 🎉 ¡Listo!

Una vez desplegado, tu aplicación estará disponible para que tus usuarios:
- Carguen archivos Excel de múltiples locales
- Comparen precios entre diferentes ubicaciones
- Filtren y busquen productos específicos
- Exporten resultados en Excel y PDF

¡Tu aplicación de comparación de precios está lista para usar!

