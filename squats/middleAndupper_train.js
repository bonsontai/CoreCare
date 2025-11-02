/**
 * squats_train.js
 * 深蹲訓練邏輯處理 (v7 - 動態等級升降)
 */

window.SquatTrainer = {
  // Status
  isTraining: false,
  currentState: 'IDLE',
  correctCount: 0,
  errorCount: 0,
  isSessionSaved: false,

  // ( ... 計時器、常數、UI 元素綁定 ... )
  sitTimeoutTimer: null,
  sitHoldTimer: null,
  SIT_TIMEOUT_DURATION: 20000,
  SIT_HOLD_LIMIT: 3000,
  coachMessage: null,
  coachHeader: null,
  coachTitle: null,
  coachBody: null,
  coachCloseButton: null,
  coachButtonContainer: null,
  trainButton: null,
  statusMessage: null,
  correctCountDisplay: null,
  errorCountDisplay: null,

  /**
   * 初始化訓練器
   * (此函式保持不變)
   */
  init: function () {
    this.trainButton = document.getElementById('trainButton');
    this.statusMessage = document.getElementById('status-message');
    this.correctCountDisplay = document.getElementById('correct-count');
    this.errorCountDisplay = document.getElementById('error-count');
    this.coachMessage = document.getElementById('coach-message');
    this.coachHeader = this.coachMessage ? this.coachMessage.querySelector('.message-header') : null;
    this.coachTitle = document.getElementById('message-title');
    this.coachBody = document.getElementById('message-body-text');
    this.coachCloseButton = document.getElementById('close-coach-message');
    this.coachNextButton = document.getElementById('next-step-button');
    this.coachButtonContainer = this.coachNextButton ? this.coachNextButton.parentElement : null;
    if (!this.trainButton || !this.correctCountDisplay || !this.errorCountDisplay || !this.coachMessage || !this.coachHeader || !this.coachTitle || !this.coachBody || !this.coachCloseButton || !this.coachButtonContainer) {
      console.error("訓練器初始化失敗：找不到必要的 UI 元素。"); return;
    }
    this.trainButton.addEventListener('click', () => this.toggleTraining());
    this.coachNextButton.style.display = 'none';
    this.coachButtonContainer.innerHTML = '';
    this.coachCloseButton.addEventListener('click', () => this.hideCoachMessage());
    this.updateUI();
  },

  /* 訓練控制*/
  /**
   * 開始或停止訓練
   * (此函式保持不變)
   */

  toggleTraining: function () {
    if (!this.isTraining && !window.currentStream) {
      this.showCoachMessage('錯誤', '請先啟動姿勢偵測才能開始訓練！', 'error');
      return;
    }

    if (this.isTraining) {
      // --- 停止訓練 ---
      this.isTraining = false;
      this.trainButton.textContent = '開始訓練';
      this.trainButton.style.backgroundColor = '#2ecc71';
      this.resetState('IDLE');
      this.hideCoachMessage();

      if (this.correctCount > 0 || this.errorCount > 0) {
        // "停止" 代表 "維持" 目前等級
        this.saveTrainingData('stopped', window.currentTrainLevel);
      }
      this.isSessionSaved = true;

    } else {
      // --- 開始訓練 ---
      this.isTraining = true;
      this.isSessionSaved = false;
      this.trainButton.textContent = '停止訓練';
      this.trainButton.style.backgroundColor = '#e74c3c';
      this.correctCount = 0;
      this.errorCount = 0;
      this.resetState('IDLE');
      this.updateUI();
      this.showCoachMessage('訓練開始', '請準備「站」姿。', 'info');
    }
  },

  /**
   * 核心函式：由 HTML 中的 predict() 呼叫
   * (此函式保持不變)
   */
  processPose: function (poseName) {
    if (!this.isTraining || poseName === "N/A") return;
    switch (this.currentState) {
      case 'IDLE':
        if (poseName === '站') {
          this.currentState = 'STARTED_STAND';
          this.showCoachMessage('動作開始', '偵測到「站」，請下蹲至定點。', 'info');
          this.clearTimers();
          this.sitTimeoutTimer = setTimeout(() => { this.logError('錯誤：20秒內未偵測到「坐」。'); }, this.SIT_TIMEOUT_DURATION);
        }
        break;
      case 'STARTED_STAND':
        if (poseName === '移動') { this.currentState = 'GOING_DOWN'; }
        break;
      case 'GOING_DOWN':
        if (poseName === '坐') {
          this.currentState = 'SITTING';
          this.showCoachMessage('到達定點', '偵測到「坐」，請開始上升至站立。', 'info');
          clearTimeout(this.sitTimeoutTimer); this.sitTimeoutTimer = null;
          this.sitHoldTimer = setTimeout(() => { this.logError('錯誤：坐姿停留超過3秒。'); }, this.SIT_HOLD_LIMIT);
        } else if (poseName === '站') { this.logError('動作錯誤：動作未完成，中途站起。'); }
        break;
      case 'SITTING':
        if (poseName === '移動') {
          this.currentState = 'GOING_UP';
          clearTimeout(this.sitHoldTimer); this.sitHoldTimer = null;
        }
        break;
      case 'GOING_UP':
        if (poseName === '站') { this.logSuccess(); }
        else if (poseName === '坐') { this.logError('動作錯誤：動作中斷，中途坐下。'); }
        break;
    }
  },

  /**
   * 紀錄一次正確的動作
   */
  logSuccess: function () {
    this.correctCount++;
    this.updateUI();
    console.log(`[LOG] 動作成功！總次數: ${this.correctCount}, 錯誤次數: ${this.errorCount}`); // 添加日誌

    // 檢查里程碑 1: 前 3 下全對
    if (this.correctCount === 1 && this.errorCount === 0) {
      this.isTraining = false;
      this.resetState('IDLE');

      this.showCoachMessage('表現優異！', '您已連續 3 次正確完成！是否要挑戰進階訓練？', 'success', [
        {
          text: '進階訓練',
          action: async () => {
            const nextLevel = this.getDynamicLevel('promote');
            await this.saveAndNavigate('promote_option', nextLevel);
          }
        },
        {
          text: '維持該訓練',
          action: () => {
            this.isTraining = true;
            this.isSessionSaved = false;
            this.showCoachMessage('繼續訓練', '請準備下一次「站」姿。', 'info');
          }
        }
      ]);
      return;
    }

    // 檢查里程碑 4: 總共 10 次正確
    if (this.correctCount === 10) {
      this.isTraining = false;
      this.resetState('IDLE');

      this.showCoachMessage('訓練完成！', '恭喜您完成 10 次正確的深蹲！', 'success', [
        {
          text: '回到主選單', // 🚨 更改按鈕文字
          action: async () => {
            // "完成" 代表 "維持" 目前等級
            const currentLevel = window.currentTrainLevel || 'middle';
            await this.saveTrainingData('complete', currentLevel);
            console.error("【跳轉主選單】資料儲存完畢。");
            // 導向主選單 (假設 main.html 在上層目錄)
            window.location.href = '../main.html';
          }
        }
      ]);
      return;
    }

    // --- 標準成功訊息 ---
    this.showCoachMessage('動作完成', `正確完成 ${this.correctCount} 次！`, 'success');
    this.resetState('IDLE');
    setTimeout(() => {
      if (this.isTraining) {
        this.showCoachMessage('下一組', '請準備下一次「站」姿。', 'info');
      }
    }, 2000);
  },

  /**
   * 紀錄一次錯誤
   */
  logError: function (message) {
    this.errorCount++;
    this.updateUI();
    this.resetState('IDLE');
    console.log(`[LOG] 動作錯誤！總次數: ${this.correctCount}, 錯誤次數: ${this.errorCount}`);

    // 檢查里程碑 2: 前 3 下全錯
    if (this.errorCount === 3 && this.correctCount === 0) {
      this.isTraining = false;
      this.showCoachMessage('訓練調整', '系統偵測您連續 3 次動作錯誤，此訓練可能不符合您當前狀態。將為您調整至較簡單的訓練。', 'error', [
        {
          text: '確認',
          action: async () => {
            const nextLevel = this.getDynamicLevel('demote');
            await this.saveAndNavigate('demote', nextLevel);
          }
        }
      ]);
      return;
    }

    // 檢查里程碑 5: 總共 5 次錯誤
    if (this.errorCount === 5) {
      this.isTraining = false;
      this.showCoachMessage('訓練調整', '累計 5 次動作錯誤，此訓練可能不符合您當前狀態。將為您調整至較簡單的訓練。', 'error', [
        {
          text: '確認',
          action: async () => {
            const nextLevel = this.getDynamicLevel('demote');
            await this.saveAndNavigate('demote', nextLevel);
          }
        }
      ]);
      return;
    }

    // --- 標準錯誤訊息 ---
    this.showCoachMessage('姿勢錯誤', message, 'error');
    setTimeout(() => {
      if (this.isTraining) {
        this.showCoachMessage('重新開始', '請重新從「站」姿開始。', 'info');
      }
    }, 2000);
  },

  /**
   * 將訓練資料傳送到後端儲存
   * (此函式保持不變)
   */
  saveTrainingData: async function (levelResult, nextLevelPosen) {
    if (this.isSessionSaved) return;

    const data = {
      Tid: new Date().toISOString(),
      Posen: window.currentTrainLevel || 'unknown', // 這次做的等級
      Level: levelResult,
      FE: this.errorCount,
      TE: this.correctCount,
      NextPosen: nextLevelPosen // 下次要做的等級
    };

    console.log('準備儲存資料:', data);

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

    try {
      const response = await fetch('http://localhost:3000/save-data', requestOptions);

      if (!response.ok) {
        throw new Error(`伺服器回應錯誤 (${response.status})`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('後端儲存成功！');
        this.isSessionSaved = true;
        return true;
      } else {
        console.error('後端儲存失敗:', result.message);
        return false;
      }
    } catch (error) {
      console.error('傳送資料至後端時發生網路錯誤:', error);
      return false;
    }
  },

  /*負責儲存數據並在成功後導航*/
  saveAndNavigate: async function (levelResult, nextLevel) {
    // 1. 儲存數據 (這會等待伺服器寫入完成)
    const success = await this.saveTrainingData(levelResult, nextLevel.level);

    if (success) {
      // 2. 只有在儲存成功後才執行頁面跳轉
      window.location.href = nextLevel.url;
    } else {
      // 3. 提示用戶儲存失敗，讓用戶可以重試或手動調整
      this.showCoachMessage('儲存失敗', '無法儲存訓練數據，請檢查伺服器狀態。', 'error', [
        { text: '重試', action: () => this.saveAndNavigate(levelResult, nextLevel) },
        { text: '取消訓練', action: () => this.toggleTraining() }
      ]);
    }
  },

  // --- 動態等級管理器 (保持不變) ---
  getDynamicLevel: function (type) {
    const current = window.currentTrainLevel || 'middle'; // 預設 'middle'

    const levels = [
      { level: 'lower', url: './lower.html' },
      { level: 'middle', url: './middle.html' },
      { level: 'upper', url: './upper.html' },
      { level: 'upperPro', url: './upperPro.html' }
    ];

    let currentIndex = levels.findIndex(l => l.level === current);
    if (currentIndex === -1) currentIndex = 1;

    let newIndex = currentIndex;
    if (type === 'promote') {
      newIndex = Math.min(currentIndex + 1, levels.length - 1);
    } else if (type === 'demote') {
      newIndex = Math.max(currentIndex - 1, 0);
    }

    console.log(`動態等級計算: ${current} -> ${type} -> ${levels[newIndex].level}`);
    return levels[newIndex];
  },
  // --- 顯示教練訊息卡片 (保持不變) ---
  showCoachMessage: function (title, body, type = 'info', buttons = []) {
    if (!this.coachMessage) return;
    this.coachTitle.textContent = title;
    this.coachBody.textContent = body;
    let borderColor = '#3498db', headerColor = '#3498db';
    if (type === 'success') {
      borderColor = '#2ecc71'; headerColor = '#2ecc71';
    } else if (type === 'error') {
      borderColor = '#e74c3c'; headerColor = '#e74c3c';
    }
    this.coachMessage.style.borderColor = borderColor;
    this.coachHeader.style.backgroundColor = headerColor;
    this.coachButtonContainer.innerHTML = '';
    if (buttons.length > 0) {
      this.coachButtonContainer.style.display = 'block';
      buttons.forEach(btnConfig => {
        const newButton = document.createElement('button');
        newButton.textContent = btnConfig.text;
        newButton.className = 'button';
        newButton.style.cssText = 'background-color: #3498db; color: white; margin-left: 10px;';
        if (typeof btnConfig.action === 'string') {
          newButton.onclick = () => { window.location.href = btnConfig.action; };
        } else if (typeof btnConfig.action === 'function') {
          newButton.onclick = btnConfig.action;
        }
        this.coachButtonContainer.appendChild(newButton);
      });
    } else {
      this.coachButtonContainer.style.display = 'none';
    }
    this.coachMessage.style.display = 'block';
  },

  /**
   * (以下函式保持不變)
   */
  hideCoachMessage: function () {
    if (this.coachMessage) { this.coachMessage.style.display = 'none'; }
    if (this.coachButtonContainer) {
      this.coachButtonContainer.innerHTML = '';
      this.coachButtonContainer.style.display = 'none';
    }
  },
  resetState: function (newState) {
    this.currentState = newState;
    this.clearTimers();
  },
  clearTimers: function () {
    if (this.sitTimeoutTimer) { clearTimeout(this.sitTimeoutTimer); this.sitTimeoutTimer = null; }
    if (this.sitHoldTimer) { clearTimeout(this.sitHoldTimer); this.sitHoldTimer = null; }
  },
  updateUI: function () {
    if (this.correctCountDisplay) { this.correctCountDisplay.textContent = this.correctCount; }
    if (this.errorCountDisplay) { this.errorCountDisplay.textContent = this.errorCount; }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.SquatTrainer.init();
});
