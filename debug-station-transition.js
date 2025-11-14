// Debug script to trace Station transition issue
// This simulates rapid next track presses until Station entry

const BASE_URL = 'http://localhost:10767';

let logIndex = 0;

function log(msg, data = null) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}] [${logIndex++}] ${msg}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function getNowPlaying() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/playback/now-playing`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      trackId: data.info?.playParams?.id,
      trackName: data.info?.name,
      isPlaying: data.info?.currentPlaybackTime !== undefined && data.info?.currentPlaybackTime > 0,
      currentTime: data.info?.currentPlaybackTime,
      duration: data.info?.durationInMillis,
    };
  } catch (err) {
    return null;
  }
}

async function callNext() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/playback/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function playItem(id, kind) {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/playback/play-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, kind })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function stop() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/playback/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

// Monitor now playing state continuously
let monitoringActive = true;
let lastTrackId = null;
let lastIsPlaying = null;

async function monitorPlayback() {
  while (monitoringActive) {
    const state = await getNowPlaying();
    
    if (!state) {
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    const trackChanged = state.trackId !== lastTrackId;
    const playingChanged = state.isPlaying !== lastIsPlaying;

    if (trackChanged || playingChanged) {
      log(`🎵 PLAYBACK STATE CHANGE`, {
        trackId: state.trackId,
        trackName: state.trackName,
        isPlaying: state.isPlaying,
        trackChanged,
        playingChanged
      });
      
      lastTrackId = state.trackId;
      lastIsPlaying = state.isPlaying;
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

async function simulateRapidNext(count, delay) {
  log(`🚀 Starting ${count} rapid NEXT presses with ${delay}ms delay`);
  
  for (let i = 0; i < count; i++) {
    log(`⏭️  Press #${i + 1}: Calling next()`);
    const success = await callNext();
    log(`   Result: ${success ? '✓ OK' : '✗ FAILED'}`);
    
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  log(`✅ Finished ${count} NEXT presses`);
}

async function simulateStationEntry() {
  log(`🎧 Simulating Station entry (stop + play station)`);
  
  // Stop first
  log(`⏹️  Calling stop()`);
  const beforeStop = await getNowPlaying();
  log(`   Before stop:`, beforeStop);
  
  await stop();
  await new Promise(r => setTimeout(r, 500));
  
  const afterStop = await getNowPlaying();
  log(`   After stop:`, afterStop);
  
  // Play a test station (example ID)
  const testStationId = 'ra.1670904153';
  log(`▶️  Calling playItem(${testStationId}, "stations")`);
  
  await playItem(testStationId, 'stations');
  
  log(`⏳ Waiting for station to start...`);
  await new Promise(r => setTimeout(r, 3000));
  
  const afterPlay = await getNowPlaying();
  log(`   Station started:`, afterPlay);
}

async function testScenario() {
  log('='.repeat(80));
  log('🧪 TEST SCENARIO: Rapid next until Station transition');
  log('='.repeat(80));
  
  // Start monitoring
  monitorPlayback();
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 1: Simulate 10 rapid next presses (100ms each = within 500ms buffer)
  log('\n📋 TEST 1: 10 rapid NEXT (100ms interval)');
  await simulateRapidNext(10, 100);
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Test 2: Now simulate entering Station
  log('\n📋 TEST 2: Enter Station mode');
  await simulateStationEntry();
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Test 3: Try pressing next a few more times (should be locked)
  log('\n📋 TEST 3: Press NEXT while in Station (should show lock behavior)');
  await simulateRapidNext(3, 500);
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Stop monitoring
  monitoringActive = false;
  
  log('\n' + '='.repeat(80));
  log('✅ Test complete');
  log('='.repeat(80));
}

// Run the test
testScenario().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
