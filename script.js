// All processing is done locally in the browser using face-api.js
// Primary and fallback model locations (folders that contain the face-api.js weights files)
const MODEL_URLS = [
  '/models', // try local folder first (place model files in a models/ folder next to index.html)
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
]

const fileA = document.getElementById('fileAadhaar')
const fileS = document.getElementById('fileSelfie')
const aadhaarName = document.getElementById('aadhaarName')
const selfieName = document.getElementById('selfieName')
const canvasA = document.getElementById('canvasAadhaar')
const canvasS = document.getElementById('canvasSelfie')
const verifyBtn = document.getElementById('verifyBtn')
const resultEl = document.getElementById('result')
const thresholdRange = document.getElementById('thresholdRange')
const thresholdVal = document.getElementById('thresholdVal')

let imgA = null
let imgS = null

async function tryLoadFrom(url){
  // try loading each model from the provided url; returns true on success
  try{
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(url),
      faceapi.nets.faceLandmark68Net.loadFromUri(url),
      faceapi.nets.faceRecognitionNet.loadFromUri(url),
      // also try SSD Mobilenet v1 (better on some photos)
      faceapi.nets.ssdMobilenetv1.loadFromUri(url),
    ])
    return true
  }catch(err){
    console.warn('Failed to load models from', url, err)
    return false
  }
}

async function loadModels(){
  resultEl.textContent = 'Loading face-api models...'
  for(const url of MODEL_URLS){
    resultEl.textContent = `Trying models from ${url} ...`
    const ok = await tryLoadFrom(url)
    if(ok){
      resultEl.textContent = 'Models loaded. Choose two images.'
      verifyBtn.disabled = false
      return
    }
  }

  // If we get here, all attempts failed
  resultEl.innerHTML = 'Error loading models from CDN. Check your network or run the app with models hosted locally. Open the browser console for details.'
  verifyBtn.disabled = true
}

function readImageFromFile(file){
  return new Promise(async (resolve, reject) => {
    try{
      // If the file is HEIC/HEIF, try converting it to a web-friendly format first
      const lower = (file.type || '').toLowerCase()
      if((lower === 'image/heic' || lower === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) && window.heic2any){
        try{
          const blob = await heic2any({blob: file, toType: 'image/jpeg', quality: 0.92})
          // blob may be a single Blob or an array
          const jpg = Array.isArray(blob) ? blob[0] : blob
          // proceed with bitmap or FileReader on the new blob
          file = jpg
        }catch(convErr){
          console.warn('HEIC conversion failed', convErr)
          // fall through and try the normal methods which will eventually error
        }
      }

      // If createImageBitmap is supported this is often more robust and faster
      if(window.createImageBitmap){
        const bitmap = await createImageBitmap(file)
        // convert bitmap to an Image via canvas
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap,0,0)
        const img = new Image()
        img.onload = ()=>resolve(img)
        img.onerror = e=>reject(new Error('Loaded bitmap but failed creating Image: '+e))
        img.src = canvas.toDataURL()
        return
      }

      const reader = new FileReader()
      reader.onload = ()=>{
        const img = new Image()
        img.onload = ()=>resolve(img)
        img.onerror = e=>reject(new Error('Image object error: '+e))
        img.src = reader.result
      }
      reader.onerror = e=>reject(new Error('FileReader error: '+e))
      reader.readAsDataURL(file)
    }catch(err){
      reject(err)
    }
  })
}

function drawImageToCanvas(image, canvas){
  const max = 420
  const ratio = Math.min(1, max / Math.max(image.width, image.height))
  const w = Math.round(image.width * ratio)
  const h = Math.round(image.height * ratio)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,w,h)
  ctx.drawImage(image, 0, 0, w, h)
}

async function handleFileInput(ev, target){
  const file = ev.target.files && ev.target.files[0]
  if(!file) return
  try{
    const img = await readImageFromFile(file)
    if(target === 'aadhaar'){
      imgA = img
      drawImageToCanvas(imgA, canvasA)
      aadhaarName.textContent = file.name
    }else{
      imgS = img
      drawImageToCanvas(imgS, canvasS)
      selfieName.textContent = file.name
    }
    resultEl.textContent = 'Ready to verify.'
  }catch(err){
    console.error(err)
    // show more helpful error to the user
    resultEl.textContent = 'Could not read the image file: ' + (err && err.message ? err.message : String(err))
    resultEl.className = 'result danger'
  }
}

fileA.addEventListener('change', e=>handleFileInput(e,'aadhaar'))
fileS.addEventListener('change', e=>handleFileInput(e,'selfie'))

function descriptorFromImage(img){
  return new Promise(async (resolve, reject)=>{
    try{
      const options = new faceapi.TinyFaceDetectorOptions({inputSize: 416, scoreThreshold: 0.5})
      const detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor()
      if(!detection){
        resolve(null)
      }else{
        resolve(detection.descriptor)
      }
    }catch(err){
      reject(err)
    }
  })
}

function euclideanDistance(d1,d2){
  let sum = 0
  for(let i=0;i<d1.length;i++){
    const diff = d1[i]-d2[i]
    sum += diff*diff
  }
  return Math.sqrt(sum)
}

// Convert distance to a similarity-ish score in [0,1]. Lower distance = more similar.
function distanceToSimilarity(dist){
  // Typical threshold for face-api is ~0.6 in distance for match; convert inversely
  // We'll map 0 -> 1, 0.6 -> 0.5, and >1.6 -> ~0
  const max = 1.6
  const s = Math.max(0, (max - dist) / max)
  return s
}

async function verify(){
  resultEl.textContent = 'Verifying...'
  if(!imgA){ resultEl.textContent = 'Please select an Aadhaar image.'; return }
  if(!imgS){ resultEl.textContent = 'Please select a selfie image.'; return }

  verifyBtn.disabled = true
  try{
    // choose detector options
    const permissive = document.getElementById('permissive') && document.getElementById('permissive').checked
    const options = new faceapi.TinyFaceDetectorOptions({inputSize: permissive ? 608 : 416, scoreThreshold: permissive ? 0.3 : 0.5})

    // helper to detect and draw box on relevant canvas
    async function detectAndDraw(img, canvas){
      const ctx = canvas.getContext('2d')
      drawImageToCanvas(img, canvas)

      // try tinyFaceDetector first
      let detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor()
      let used = 'tiny'
      if(!detection){
        // try SSD Mobilenet v1 (slower but sometimes finds different faces)
        try{
          detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({minConfidence: 0.3})).withFaceLandmarks().withFaceDescriptor()
          used = 'ssd'
        }catch(_e){
          // ignore
        }
      }

      if(detection && detection.detection){
        const box = detection.detection.box
        ctx.strokeStyle = '#06b6d4'
        ctx.lineWidth = 2
        ctx.strokeRect(box.x, box.y, box.width, box.height)
        ctx.fillStyle = '#000'
        ctx.font = '12px sans-serif'
        ctx.fillText(used + ' conf: '+detection.detection.score.toFixed(3), box.x, Math.max(12, box.y - 4))
      }
      return detection ? detection.descriptor : null
    }

    const [dA, dS] = await Promise.all([detectAndDraw(imgA, canvasA), detectAndDraw(imgS, canvasS)])
    if(!dA){ resultEl.innerHTML = '❌ No face detected in Aadhaar image.'; resultEl.className='result danger'; verifyBtn.disabled=false; return }
    if(!dS){ resultEl.innerHTML = '❌ No face detected in Selfie image.'; resultEl.className='result danger'; verifyBtn.disabled=false; return }

    const dist = euclideanDistance(dA,dS)
    const similarity = distanceToSimilarity(dist)
    const threshold = thresholdRange ? Number(thresholdRange.value) : 0.6
    resultEl.className = 'result'
    resultEl.innerHTML = `Distance: ${dist.toFixed(4)} — Similarity: ${similarity.toFixed(3)}<br/>`
    if(similarity > threshold){
      resultEl.innerHTML += `✅ Face Matched (threshold ${threshold.toFixed(3)})`
      resultEl.className='result success'
    }else{
      resultEl.innerHTML += `❌ Face Not Matched (threshold ${threshold.toFixed(3)})`
      resultEl.className='result danger'
    }
  }catch(err){
    console.error(err)
    resultEl.textContent = 'Error during verification. See console for details.'
  }finally{
    verifyBtn.disabled = false
  }
}

verifyBtn.addEventListener('click', verify)

// Start loading models as soon as script runs
loadModels()

// update threshold display
if(thresholdRange && thresholdVal){
  thresholdVal.textContent = Number(thresholdRange.value).toFixed(3)
  thresholdRange.addEventListener('input', ()=>{
    thresholdVal.textContent = Number(thresholdRange.value).toFixed(3)
  })
}
