/**
 * Capa de persistencia asíncrona con IndexedDB
 * Base de datos local para AgroBitácora con soporte para almacenamiento de Blobs (fotos),
 * coordenadas geográficas y control de sincronización offline.
 */
class AgroDB {
  constructor() {
    this.dbName = 'AgroBitacoraDB';
    this.version = 1;
    this.storeName = 'observaciones';
    this.db = null;
  }

  // Inicialización de la base de datos y esquema de almacenes
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Índices para consultas y filtros
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('sincronizado', 'sincronizado', { unique: false });
          store.createIndex('cultivo', 'cultivo', { unique: false });
          store.createIndex('categoria', 'categoria', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Error al abrir base de datos:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Insertar una nueva observación de campo (soporta Blobs fotográficos)
  async agregarObservacion(data) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('IndexedDB no inicializada'));

      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      const record = {
        ...data,
        fecha: new Date().toISOString(),
        sincronizado: 0 // 0 = pendiente de sincronización, 1 = sincronizado
      };

      const request = store.add(record);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Obtener todas las observaciones ordenadas de la más reciente a la más antigua
  async obtenerTodas() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('IndexedDB no inicializada'));

      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // Invertir orden para mostrar el registro más nuevo primero
        const lista = request.result.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        resolve(lista);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Eliminar un registro por ID
  async eliminarObservacion(id) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('IndexedDB no inicializada'));

      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(Number(id));

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Contar registros pendientes de sincronización
  async contarPendientes() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('IndexedDB no inicializada'));

      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Compatible con boolean (false), numérico (0) o ausente
          const syncVal = cursor.value.sincronizado;
          if (syncVal === 0 || syncVal === false || syncVal === undefined || syncVal === 'no') {
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Instancia global compartida
window.agroDB = new AgroDB();
