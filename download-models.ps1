<#
Download face-api.js model weight files into a local `models` folder.
Run from PowerShell in the project root:

  .\download-models.ps1

This script will create a `models` folder and download the files required by:
 - tiny_face_detector
 - face_landmark_68
 - face_recognition

The files are fetched from the face-api.js GitHub repository.
#>

$outDir = Join-Path -Path $PSScriptRoot -ChildPath 'models'
if(-Not (Test-Path $outDir)){
  New-Item -Path $outDir -ItemType Directory | Out-Null
}

$base = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'
$files = @(
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1.bin'
)

foreach($f in $files){
  $url = "$base/$f"
  $out = Join-Path $outDir $f
  try{
    Write-Host "Downloading $f ..."
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -ErrorAction Stop
  }catch{
    Write-Warning "Failed to download $f from $url. Error: $_"
  }
}

Write-Host "Done. Models saved to $outDir"
