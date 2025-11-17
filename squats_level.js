// squats_level.js (已修改為通用等級載入器)

// 定義訓練類別與對應的 CSV 欄位名稱和資料夾路徑
const TRAINING_MAP = {
    'squats': { column: 'last_squats_train_level', folder: 'squats' },
    'advances': { column: 'last_advances_train_level', folder: 'advances' },
    'sitting': { column: 'last_sitting_train_level', folder: 'sitting' }
    // 注意：請確保您的坐姿訓練頁面放在 'sitting' 資料夾中
};

const VALID_LEVELS = ['upperpro', 'upper', 'middle', 'lower'];
const DEFAULT_LEVEL_KEY = 'middle';


/**
 * 輔助函式：從表格格式 CSV 內容中提取最後一筆資料的訓練等級
 * 【已修改：接受目標欄位名稱作為參數】
 * @param {string} csvContent - 整個 CSV 檔案的文字內容
 * @param {string} targetColumnName - 要尋找的特定等級欄位名稱 (例如 'last_squats_train_level')
 * @returns {string|null} - 返回建議的等級字串，否則為 null
 */
function getTrainingLevelFromTable(csvContent, targetColumnName) {
    const text = csvContent.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) return null;

    const header = lines[0].split(',').map(h => h.trim());
    // 尋找動態傳入的目標欄位名稱
    const targetIndex = header.findIndex(h => h.toLowerCase() === targetColumnName);

    if (targetIndex === -1) return null;

    const lastDataLine = lines[lines.length - 1];
    const dataValues = lastDataLine.split(',').map(v => v.trim());

    if (dataValues.length <= targetIndex) return null;

    const level = dataValues[targetIndex];
    return level ? level.toLowerCase() : null;
}


document.addEventListener('DOMContentLoaded', () => {

    // 取得所有帶有 'training-link' class 的連結
    const trainingLinks = document.querySelectorAll('.training-link');
    const iframe = document.getElementById('content');

    if (trainingLinks.length === 0 || !iframe) {
        console.error('找不到訓練連結或 content iFrame 元素。');
        return;
    }

    // 儲存初始化時讀取的深蹲等級 (供深蹲訓練檔案中的 isTrainingPaused 判斷使用)
    let initialSquatLevel = DEFAULT_LEVEL_KEY; 


    // --- 訓練等級動態載入的核心邏輯 ---
    trainingLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();

            const type = link.dataset.trainType; // 取得訓練類型: 'squats', 'advances', 'sitting'
            const config = TRAINING_MAP[type];
            
            if (!config) {
                 console.error(`未知的訓練類型: ${type}`);
                 return;
            }

            // 1. 執行非同步讀取 CSV
            fetch('../person.csv', { cache: 'no-store' })
                .then(res => {
                    if (!res.ok) throw new Error(`讀取 CSV 失敗 (${res.status})`);
                    return res.text();
                })
                .then(csvText => {
                    // 2. 使用該訓練類型的 CSV 欄位名稱來獲取等級
                    let levelKey = getTrainingLevelFromTable(csvText, config.column) || DEFAULT_LEVEL_KEY;

                    // 確保 levelKey 是有效的等級
                    if (!VALID_LEVELS.includes(levelKey)) {
                        console.warn(`CSV等級 [${levelKey}] 無效，使用預設值 ${DEFAULT_LEVEL_KEY}。`);
                        levelKey = DEFAULT_LEVEL_KEY;
                    }

                    // 3. 設定全域變數和載入 iFrame
                    window.currentTrainLevel = levelKey; // 設定當前訓練等級

                    let targetUrl = `/${config.folder}/${levelKey}.html`; // 組合成動態路徑
                    iframe.src = targetUrl;
                    
                    console.log(`[${type}] 等級設定為: ${levelKey}，載入連結: ${targetUrl}`);


                    // 4. 更新高亮狀態
                    document.querySelectorAll('.training-link').forEach(el => el.classList.remove('is-primary'));
                    link.classList.add('is-primary');
                })
                .catch(error => {
                    console.error(`[${type}] 載入等級失敗，使用預設等級 (${DEFAULT_LEVEL_KEY})。`, error.message);
                    
                    // 錯誤處理：直接載入該訓練類型 + 預設等級
                    window.currentTrainLevel = DEFAULT_LEVEL_KEY;
                    let defaultUrl = `/${config.folder}/${DEFAULT_LEVEL_KEY}.html`;
                    iframe.src = defaultUrl;

                    document.querySelectorAll('.training-link').forEach(el => el.classList.remove('is-primary'));
                    link.classList.add('is-primary');
                });
        });
    });

    // --- 初始深蹲等級設定 (用於訓練檔案中) ---
    // 這裡保留原本的 DOMContentLoaded 邏輯來讀取初始的 window.currentTrainLevel，
    // 以確保頁面載入時，訓練邏輯可以知道預設的深蹲等級 (即使沒有點擊按鈕)。
    fetch('../person.csv', { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error(`讀取初始 CSV 失敗 (${res.status})`);
            return res.text();
        })
        .then(csvText => {
            let squatLevelKey = getTrainingLevelFromTable(csvText, TRAINING_MAP['squats'].column) || DEFAULT_LEVEL_KEY;
            if (!VALID_LEVELS.includes(squatLevelKey)) squatLevelKey = DEFAULT_LEVEL_KEY;

            window.currentTrainLevel = squatLevelKey;
            console.log(`初始全域深蹲 Level 設定為: ${squatLevelKey}`);
        })
        .catch(error => {
            window.currentTrainLevel = DEFAULT_LEVEL_KEY;
            console.log(`初始 CSV 載入失敗，將全域 Level 設為預設值: ${DEFAULT_LEVEL_KEY}`);
        });

});