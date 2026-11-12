/**
 * Módulo de Cámara (MediaDevices API + HTML5 File Capture Fallback)
 * Captura fotografías del cultivo o plaga en terreno y las convierte en Blobs.
 */
class CameraService {
  constructor(videoElement, previewElement, streamContainer, previewContainer) {
    this.video = videoElement;
    this.preview = previewElement;
    this.streamContainer = streamContainer;
    this.previewContainer = previewContainer;
    this.stream = null;
    this.currentBlob = null;
  }

  // Activar visor de cámara en vivo con lente trasera (ideal para parcelas)
  async startStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API no disponible');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Cámara posterior
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      this.streamContainer.style.display = 'block';
      this.previewContainer.style.display = 'none';
    } catch (err) {
      console.warn('[Cámara] Error al abrir getUserMedia:', err);
      throw err;
    }
  }

  // Apagar sensor y liberar hardware (ahorro de batería en campo)
  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.streamContainer.style.display = 'none';
    }
  }

  // Capturar fotograma sobre un canvas y convertir a Blob JPEG
  takeSnapshot() {
    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth || 640;
    canvas.height = this.video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        this.currentBlob = blob;
        this.preview.src = URL.createObjectURL(blob);
        this.previewContainer.style.display = 'block';
        this.stopStream(); // Apagar visor de inmediato
        resolve(blob);
      }, 'image/jpeg', 0.85); // Calidad 85% para optimizar tamaño en IndexedDB
    });
  }

  // Fallback: procesar imagen cargada desde <input type="file" capture="environment">
  handleFileSelection(file) {
    this.currentBlob = file;
    this.preview.src = URL.createObjectURL(file);
    this.previewContainer.style.display = 'block';
    this.streamContainer.style.display = 'none';
    return file;
  }

  // Descartar foto actual
  clearPhoto() {
    this.currentBlob = null;
    this.preview.src = '';
    this.previewContainer.style.display = 'none';
    this.stopStream();
  }
}

window.CameraService = CameraService;
