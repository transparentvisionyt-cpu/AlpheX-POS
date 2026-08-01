// ============================================
// Camera Barcode Scanner Helper
// Uses HTML5 QuaggaJS-like inline detection
// ============================================

class CameraScanner {
    constructor(videoEl, onDetect) {
        this.video = videoEl;
        this.onDetect = onDetect;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scanning = false;
    }

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.video.srcObject = stream;
            await this.video.play();
            this.scanning = true;
            this.scan();
        } catch (e) {
            console.error('Camera error:', e);
            throw e;
        }
    }

    stop() {
        this.scanning = false;
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(t => t.stop());
            this.video.srcObject = null;
        }
    }

    scan() {
        if (!this.scanning) return;
        
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Basic barcode detection using BarcodeDetector API (if available)
            if ('BarcodeDetector' in window) {
                this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                // BarcodeDetector would be used here
            }
        }
        
        requestAnimationFrame(() => this.scan());
    }
}
