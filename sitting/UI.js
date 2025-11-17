// ------------------------------------------------------------------
// 1. Teachable Machine 核心邏輯
// ------------------------------------------------------------------

// 🌟 核心修改：定義模型 URL 映射表，實現動態載入
// 根據 CSV 讀取到的 currentTrainLevel，選擇對應的模型 URL
const MODEL_URLS = {
  // 範例：假設所有等級都使用不同的模型
  'upperpro': "https://teachablemachine.withgoogle.com/models/mUsYIH6Vi/",
  'upper': "https://teachablemachine.withgoogle.com/models/mUsYIH6Vi/",
  'middle': "https://teachablemachine.withgoogle.com/models/mUsYIH6Vi/", // Middle/Upper 使用的模型
  'lower': "https://teachablemachine.withgoogle.com/models/akY-bmRdS/", // Lower 使用的模型 (已修正空格)
};

let model, webcam, ctx, labelContainer, maxPredictions;
let lastRawPose = null;       // 儲存上一幀偵測到的原始姿勢
let poseFrameCounter = 0;   // 連續相同姿勢的計數器
const POSE_CONFIRM_FRAMES = 3;
let currentStream = null;
window.currentTrainLevel = null; // *** 儲存當前訓練等級 ***

// UI 元素
const startButton = document.getElementById('startButton');
const trainButton = document.getElementById('trainButton');
const statusMessage = document.getElementById('status-message');
const canvas = document.getElementById("canvas");
const trainVideo = document.getElementById('train-video');


// 啟動 TM 模型
async function init() {
  if (webcam && webcam.canvas) {
    webcam.stop(); // 如果已經啟動，先停止
  }

  // *** 核心變動：根據 currentTrainLevel 選擇模型 URL ***
  const level = window.currentTrainLevel || 'middle'; // 確保有預設值
  const tmModelBaseUrl = MODEL_URLS[level];

  if (!tmModelBaseUrl) {
    statusMessage.style.color = '#e74c3c';
    statusMessage.textContent = `錯誤：找不到對應訓練等級 (${level}) 的模型連結！`;
    startButton.disabled = false;
    return;
  }

  statusMessage.textContent = `載入模型中 (等級: ${level})...`;
  startButton.disabled = true;

  // *** 修正: 使用動態選擇的 tmModelBaseUrl 替換 TM_MODEL_URL ***
  const modelURL = tmModelBaseUrl + "model.json";
  const metadataURL = tmModelBaseUrl + "metadata.json";

  // 載入模型
  try {
    // 載入外部 URL
    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
  } catch (error) {
    statusMessage.style.color = '#e74c3c';
    statusMessage.textContent = '錯誤：無法載入 Teachable Machine 模型。請檢查公共 URL 是否正確！';
    startButton.disabled = false;
    console.error("模型載入失敗:", error);
    return;
  }

  // 設置攝像頭
  let sizeW = 1080; // 預設值
  let sizeH = 1080; // 預設值

  const flip = true;

  webcam = new tmPose.Webcam(sizeW, sizeH, flip);

  try {
    await webcam.setup(); // 請求攝像頭權限
    await webcam.play();
  } catch (error) {
    // 捕獲攝像頭權限錯誤 (例如：使用者拒絕)
    console.error("攝像頭啟動失敗:", error);
    statusMessage.style.color = '#e74c3c';
    statusMessage.textContent = '錯誤：無法啟動攝像頭。請檢查瀏覽器權限！';
    startButton.disabled = false; // 讓使用者可以重試
    return; // 中斷 init
  }

  window.currentStream = true;

  // 設置 Canvas 尺寸與內容
  canvas.width = sizeW;
  canvas.height = sizeH;
  ctx = canvas.getContext("2d");

  statusMessage.style.color = '#2ecc71';
  statusMessage.textContent = '姿勢偵測已啟動！';
  startButton.textContent = '重新偵測/切換攝像頭';
  startButton.disabled = false;

  // 開始循環
  window.requestAnimationFrame(loop);
}

async function loop(timestamp) {
  webcam.update();
  await predict();
  window.requestAnimationFrame(loop);
}

async function predict() {
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
  const prediction = await model.predict(posenetOutput);

  let maxProb = 0;
  let rawPredictedClass = "N/A"; // 1. 原始偵測的類別

  // 找出當前幀的最高機率類別
  for (let i = 0; i < maxPredictions; i++) {
    const classPrediction = prediction[i];

    if (classPrediction.probability > maxProb) {
      maxProb = classPrediction.probability;
      rawPredictedClass = classPrediction.className;
    }
  }

  // --- ↓↓↓ 這是新的「平滑化/Debouncing」邏輯 ↓↓↓ ---

  let confirmedPose = "N/A"; // 最終確認的姿勢 (要傳給狀態機的)

  // 2. 檢查信心度是否足夠 (例如 > 0.85)，信心度太低就忽略
  if (maxProb > 0.85) {

    if (rawPredictedClass === lastRawPose) {
      // 3. 如果與上一幀「原始」姿勢相同，計數器增加
      poseFrameCounter++;
    } else {
      // 4. 如果姿勢改變，重設計數器，並更新「上一幀」姿勢
      lastRawPose = rawPredictedClass;
      poseFrameCounter = 1;
    }

  } else {
    // 信心度不足，重置
    lastRawPose = null;
    poseFrameCounter = 0;
  }

  // 5. 只有當連續幀數達標時，才「確認」該姿勢
  if (poseFrameCounter >= POSE_CONFIRM_FRAMES) {
    confirmedPose = lastRawPose; // 確認姿勢！
  }

  // --- ↑↑↑ 平滑化邏輯結束 ↑↑↑ ---


  // 6. 更新 UI 狀態訊息 (保持即時反應)
  //    我們仍然顯示 rawPredictedClass，讓使用者看到即時偵測
  if (maxProb > 0.8) {
    statusMessage.textContent = `姿勢：${rawPredictedClass} (${(maxProb * 100).toFixed(0)}%)`;
    statusMessage.style.color = '#3498db';

    // (可選) 增加一個視覺提示，讓你知道什麼姿勢被「確認」了
    if (confirmedPose !== "N/A" && confirmedPose === rawPredictedClass) {
      statusMessage.textContent += " [已確認]";
      statusMessage.style.color = '#2ecc71'; // 已確認時變綠色
    }

  } else {
    statusMessage.textContent = `偵測中...`;
    statusMessage.style.color = '#e67e22';
  }

  // 7. 將「已確認」的姿勢(confirmedPose)傳遞給訓練狀態機
  //    注意：這裡傳遞的是 confirmedPose，而不是 rawPredictedClass
  if (window.SquatTrainer) {
    
    window.SquatTrainer.processPose(confirmedPose);
  }

  drawPose(pose);
}

function drawPose(pose) {
  if (webcam.canvas) {
    ctx.drawImage(webcam.canvas, 0, 0, canvas.width, canvas.height);
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }
}


// ------------------------------------------------------------------
// 2. 介面與邏輯連結
// ------------------------------------------------------------------

// 啟動按鈕改為觸發 TM 的 init
startButton.addEventListener('click', init);
// --- 其他邏輯保持不變 ---

function positionControlArea() {
  const frame3 = document.querySelector('.frame3');
  const controlArea = document.querySelector('.control-area');

  if (frame3 && controlArea) {
    const frame3Rect = frame3.getBoundingClientRect();

    // ⭐️ 關鍵：將 controlArea 的 top 設為 frame3 的底部位置 + 20px 間距
    controlArea.style.position = 'absolute'; // 確保它是絕對定位 
    controlArea.style.top = (frame3Rect.bottom + 20) + 'px';
    controlArea.style.bottom = 'auto'; // 確保 bottom 屬性被清除
  }
}

window.addEventListener('load', positionControlArea);
window.addEventListener('resize', positionControlArea);

// ------------------------------------------------------------------
// 3. CSV 讀取與 Level 初始化 (已移除 UI 更新)
// ------------------------------------------------------------------

/**
 * 輔助函式：從表格格式 CSV 內容中提取最後一筆資料的訓練等級
 * @param {string} csvContent - 整個 CSV 檔案的文字內容
 * @returns {string|null} - 返回 'upper', 'middle', 'lower' 之一，否則為 null
 */

function getTrainingLevelFromTable(csvContent) {
  // 移除 BOM (字節順序標記)
  const text = csvContent.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) return null;

  const header = lines[0].split(',').map(h => h.trim());
  const targetIndex = header.findIndex(h => h.toLowerCase() === 'last_squats_train_level');

  if (targetIndex === -1) return null;

  // 從最後一行數據中提取值
  const lastDataLine = lines[lines.length - 1];
  const dataValues = lastDataLine.split(',').map(v => v.trim());

  if (dataValues.length <= targetIndex) return null;

  const level = dataValues[targetIndex];
  return level ? level.toLowerCase() : null;
}

const VALID_LEVELS = ['upperpro', 'upper', 'middle', 'lower'];
const DEFAULT_LEVEL_KEY = 'middle';


document.addEventListener('DOMContentLoaded', () => {

  // 嘗試讀取 CSV
  fetch('../person.csv', { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error(`讀取 CSV 失敗 (${res.status})`);
      return res.text();
    })
    .then(csvText => {
      let levelKey = getTrainingLevelFromTable(csvText) || DEFAULT_LEVEL_KEY;

      // 確保 levelKey 是有效的等級，否則使用預設值
      if (!VALID_LEVELS.includes(levelKey)) {
        console.warn(`CSV等級 [${levelKey}] 無效，使用預設值 ${DEFAULT_LEVEL_KEY}。`);
        levelKey = DEFAULT_LEVEL_KEY;
      }

      // ⭐️ 關鍵：設定全域變數供 squats_train.js 使用 ⭐️
      window.currentTrainLevel = levelKey;

      console.log(`成功讀取 person.csv，並將當前訓練器 Level 設定為: ${levelKey}`);

    })
    .catch(error => {
      console.error("CSV 讀取或解析失敗，使用預設等級:", error.message);

      // 失敗時使用預設等級設定全域變數 (關鍵)
      window.currentTrainLevel = DEFAULT_LEVEL_KEY;
      console.log(`CSV 載入失敗，將當前訓練器 Level 設定為預設值: ${DEFAULT_LEVEL_KEY}`);
    });
});