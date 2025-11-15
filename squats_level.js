// squats_level.js

// 預設等級設定
const DEFAULT_LEVEL_KEY = 'middle';
const DEFAULT_URL = `/squats/${DEFAULT_LEVEL_KEY}.html`;

// 確保 DOM 元素載入完成後才執行
document.addEventListener('DOMContentLoaded', () => {

    // 1. 取得您設定的超連結元素
    const link = document.getElementById('squat-training-link');

    // ⭐ 新增: 取得 iFrame 元素 (您的 HTML 中 ID 是 'content')
    const iframe = document.getElementById('content');

    // 檢查元素是否存在，確保程式碼不會出錯
    if (link && iframe) {
        // 2. 綁定 'click' 事件處理器
        link.addEventListener('click', (event) => {

            // 阻止連結預設的導航行為
            event.preventDefault();

            console.log('正在嘗試讀取 person.csv 檔案...');

            // 3. 使用 Fetch API 讀取 CSV 檔案
            fetch('person.csv')
                .then(response => {
                    // 檢查 HTTP 狀態碼 (例如 404, 500)
                    if (!response.ok) {
                        // 如果檔案載入失敗 (例如 404)，則拋出錯誤，讓 catch 區塊處理
                        throw new Error(`無法載入檔案: ${response.statusText} (${response.status})`);
                    }
                    // 將回應內容轉換為純文字
                    return response.text();
                })
                .then(csvText => {
                    // 4. 解析 CSV 文字內容並取得等級
                    const readLevel = getTrainingLevelFromTable(csvText);

                    // 5. 應用預設值的程式碼 (核心修正點)
                    // 如果 readLevel 是 null 或無效字串，則採用 DEFAULT_LEVEL_KEY ('middle')
                    const finalLevel = readLevel || DEFAULT_LEVEL_KEY;
                    
                    // 確保 finalLevel 是有效的訓練等級
                    if (['upper', 'middle', 'lower', 'upperPro'].includes(finalLevel)) {
                        
                        // 假設訓練頁面位於 /squats/ 目錄
                        let targetUrl = `/squats/${finalLevel}.html`;
                        console.log(`訓練等級為 ${finalLevel}，載入 iFrame 連結: ${targetUrl}`);

                        // ⭐ 關鍵修改: 執行 iFrame 載入
                        iframe.src = targetUrl;
                        
                        // (您可能需要將這個 finalLevel 儲存到 window.currentTrainLevel 供訓練檔案使用)
                        window.currentTrainLevel = finalLevel; 

                        // 可選：點擊後讓該連結保持高亮
                        document.querySelectorAll('.navbar-item').forEach(el => el.classList.remove('is-primary'));
                        link.classList.add('is-primary');

                    } else {
                        // 如果從 CSV 讀取到的值是無效的等級名稱 (但不是 null)
                        console.warn(`CSV 讀取到無效等級: ${readLevel}，已嘗試使用預設值 ${DEFAULT_LEVEL_KEY}`);
                        
                        // 確保無效等級也能載入預設頁面 (middle.html)
                        iframe.src = DEFAULT_URL;
                        window.currentTrainLevel = DEFAULT_LEVEL_KEY;
                    }
                })
                .catch(error => {
                    // 檔案讀取或網路錯誤處理 (例如 404)
                    console.error('讀取檔案時發生錯誤，將使用預設等級:', error);
                    
                    // 錯誤時，直接載入預設頁面 (middle.html)
                    iframe.src = DEFAULT_URL; 
                    window.currentTrainLevel = DEFAULT_LEVEL_KEY;
                });
        });
    } else {
        console.error('CoreCare: 找不到深蹲連結按鈕或 content iFrame 元素。');
    }
});

/**
 * 輔助函式：從表格格式 CSV 內容中提取最後一筆資料的訓練等級
 * (此函式已包含錯誤處理，並在錯誤時返回 null)
 */
function getTrainingLevelFromTable(csvText) {
    // 1. 將內容按行分割，並過濾掉空行
    csvText = csvText.replace(/^\uFEFF/, '');
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');

    // 錯誤處理 1: CSV 檔案中沒有標題或資料行
    if (lines.length < 2) {
        console.error('CSV 檔案中沒有標題或資料行。'); // 您回報的錯誤訊息
        return null;
    }

    // 2. 處理標題行 (Header)
    const header = lines[0].split(',').map(h => h.trim());

    // 找出 'last_squats_train_level' 標籤所在的欄位索引
    const targetColumnName = 'last_squats_train_level';
    const targetIndex = header.findIndex(h => h.toLowerCase() === targetColumnName);

    // 錯誤處理 2: 找不到目標欄位
    if (targetIndex === -1) {
        console.error(`在 CSV 標題中找不到 '${targetColumnName}' 欄位。`); // 您回報的錯誤訊息
        return null;
    }

    // 讀取最後一筆資料的該欄位值
    const lastDataLine = lines[lines.length - 1];
    const values = lastDataLine.split(',');

    // 如果欄位內沒有值，也返回 null
    const lastLevel = values[targetIndex] ? values[targetIndex].trim() : null;

    return lastLevel;
}