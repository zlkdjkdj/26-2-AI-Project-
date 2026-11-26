# 태블릿 전용 APK(홈캠 모니터링·촬영만, 가로 회전 허용)를 빌드한다.
# 폰용 빌드 폴더(기본 C:\ac-homecam\n)의 원본 파일을 잠시 바꿨다가 끝나면 되돌린다.
param(
  [string]$Build = "C:\ac-homecam\n",
  [string]$Out = "$env:USERPROFILE\Desktop\앗차차-태블릿-1.3.14.apk"
)
$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $PSScriptRoot
$manifest = "$Build\android\app\src\main\AndroidManifest.xml"
$gradle = "$Build\android\app\build.gradle"
$strings = "$Build\android\app\src\main\res\values\strings.xml"
$files = @($manifest, $gradle, $strings)
$bak = "$Build\tablet-backup"   # res 폴더 밖에 둬야 리소스 병합이 깨지지 않는다
New-Item -ItemType Directory -Force $bak | Out-Null

# 1) 최신 JS 소스를 빌드 폴더로 동기화 (package.json 등 설정은 건드리지 않는다)
foreach ($f in "src\variant.js","src\appUi.js","src\app\index.js","src\app\homecam.js","src\app\photo.js","src\app\viewer.js","src\app\camera.js","src\DirectVideo.js","src\videoFit.js","src\sdpOrientation.js","src\videoCodecs.js","src\videoQuality.js") {
  Copy-Item "$src\$f" "$Build\$f" -Force
}

# Metro 변환 캐시는 EXPO_PUBLIC_TABLET 값을 키에 넣지 않는다. 폰·태블릿 빌드가 서로의 값을 재사용하지 않도록 비운다.
$metro = Join-Path $env:TEMP "metro-cache"
if (Test-Path $metro) { Remove-Item -LiteralPath $metro -Recurse -Force }

# 2) 원본 백업 후 태블릿용으로 변경
foreach ($f in $files) { Copy-Item $f "$bak\$(Split-Path -Leaf $f)" -Force }
try {
  $m = [IO.File]::ReadAllText($manifest)
  $m = $m.Replace('android:screenOrientation="portrait"', 'android:screenOrientation="fullSensor"')
  [IO.File]::WriteAllText($manifest, $m)
  $g = [IO.File]::ReadAllText($gradle)
  $g = $g.Replace("applicationId 'com.atchacha.homecam'", "applicationId 'com.atchacha.homecam.tablet'")
  [IO.File]::WriteAllText($gradle, $g)
  $st = [IO.File]::ReadAllText($strings)
  $st = $st.Replace('<string name="app_name">앗차차 홈캠</string>', '<string name="app_name">앗차차 태블릿</string>')
  [IO.File]::WriteAllText($strings, $st)

  # 3) 빌드 (EXPO_PUBLIC_TABLET 은 Metro가 번들 시점에 코드에 넣는다)
  $env:EXPO_PUBLIC_TABLET = "1"
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
  Push-Location "$Build\android"
  & .\gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=arm64-v8a" --no-daemon -I "$Build\scripts\homecam-release.gradle"
  if ($LASTEXITCODE -ne 0) { throw "gradle 빌드 실패($LASTEXITCODE)" }
  Pop-Location
  Copy-Item "$Build\android\app\build\outputs\apk\release\app-release.apk" $Out -Force
  Write-Host "완료: $Out"
}
finally {
  # 4) 폰용 설정 복구
  Remove-Item Env:\EXPO_PUBLIC_TABLET -ErrorAction SilentlyContinue
  foreach ($f in $files) { $b = "$bak\$(Split-Path -Leaf $f)"; if (Test-Path $b) { Move-Item $b $f -Force } }
}
