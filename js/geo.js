/**
 * Módulo de Geolocalización (Geolocation API)
 * Captura coordenadas GPS de alta precisión en parcela agrícola.
 */
const GeoService = {
  geoOptions: {
    enableHighAccuracy: true, // Fuerza el uso del receptor GPS por encima de triangulación
    timeout: 15000,          // 15 segundos para fijar señal de satélites
    maximumAge: 0            // No aceptar lecturas cacheadas del sistema
  },

  obtenerCoordenadas() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        return reject(new Error('El navegador o dispositivo no soporta la API de Geolocalización.'));
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy, // Margen de error en metros
            timestamp: position.timestamp
          });
        },
        (error) => {
          let mensaje = 'Error de GPS desconocido';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              mensaje = 'Permiso de ubicación denegado en el dispositivo.';
              break;
            case error.POSITION_UNAVAILABLE:
              mensaje = 'Señal GPS no disponible (compruebe que la ubicación esté activada).';
              break;
            case error.TIMEOUT:
              mensaje = 'Tiempo de espera agotado buscando satélites GPS.';
              break;
          }
          reject(new Error(mensaje));
        },
        this.geoOptions
      );
    });
  }
};

window.GeoService = GeoService;
