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

            // 阻止連結預設的導航行為 (即阻止它跳到 href="#")
            event.preventDefault();

            console.log('正在嘗試讀取 person.csv 檔案...');

            // 3. 使用 Fetch API 讀取 CSV 檔案
            fetch('person.csv')
                .then(response => {
                    // 檢查 HTTP 狀態碼 (例如 404, 500)
                    if (!response.ok) {
                        throw new Error(`無法載入檔案: ${response.statusText} (${response.status})`);
                    }
                    // 將回應內容轉換為純文字
                    return response.text();
                })
                .then(csvText => {
                    // 4. 解析 CSV 文字內容並取得等級
                    const level = getTrainingLevelFromTable(csvText);

                    // 5. 根據 level 載入 iFrame
                    if (level && ['upper', 'middle', 'lower'].includes(level)) {
                        // 假設訓練頁面位於 /squats/ 目錄
                        let targetUrl = `/squats/${level}.html`;
                        console.log(`訓練等級為 ${level}，載入 iFrame 連結: ${targetUrl}`);

                        // ⭐ 關鍵修改: 執行 iFrame 載入，而不是頁面導航
                        iframe.src = targetUrl;
                        
                        // 可選：點擊後讓該連結保持高亮 (配合您的 Bulma is-primary 樣式)
                        document.querySelectorAll('.navbar-item').forEach(el => el.classList.remove('is-primary'));
                        link.classList.add('is-primary');

                    } else {
                        // 找不到有效等級時的錯誤處理
                        console.error("在 CSV 中找不到有效的 'last_squats_train_level' 標籤或其值無效。");
                        alert('訓練等級資訊遺失或無效，請檢查檔案。');
                    }
                })
                .catch(error => {
                    // 檔案讀取或網路錯誤處理
                    console.error('讀取檔案時發生錯誤:', error);
                    alert('訓練等級載入失敗，請檢查檔案路徑和伺服器狀態。');
                });
        });
    } else {
         console.error('CoreCare: 找不到深蹲連結按鈕或 content iFrame 元素。');
    }
});

/**
 * 輔助函式：從表格格式 CSV 內容中提取最後一筆資料的訓練等級
 * (此函式內容無需修改，它已正確解析您的表格式 CSV)
 */
function getTrainingLevelFromTable(csvContent) {
    // 1. 將內容按行分割，並過濾掉空行
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');

    if (lines.length < 2) {
        console.error('CSV 檔案中沒有標題或資料行。');
        return null;
    }

    // 2. 處理標題行 (Header)
    const header = lines[0].split(',').map(h => h.trim());

    // 找出 'last_squats_train_level' 標籤所在的欄位索引
    const targetIndex = header.findIndex(h => h.toLowerCase() === 'last_squats_train_level');

    if (targetIndex === -1) {
        console.error("在 CSV 標題中找不到 'last_squats_train_level' 欄位。");
        return null;
    }

    // 3. 處理最後一筆資料行
    const lastDataLine = lines[lines.length - 1];
    const dataValues = lastDataLine.split(',').map(v => v.trim());

    if (dataValues.length <= targetIndex) {
        console.error('最後一筆資料行的欄位數不足。');
        return null;
    }

    // 4. 提取對應索引的值
    const level = dataValues[targetIndex];

    // 5. 返回小寫的值
    return level ? level.toLowerCase() : null;
}