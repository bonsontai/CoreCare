// --- ↓↓↓ 中文翻譯對照表 ↓↓↓ ---
// 全域變數，用於儲存原始 CSV 資料
let ALL_TRAINING_DATA = { headers: [], rows: [] };

// 訓練姿勢所需的欄位列表
const COLUMN_MAPS = {
    'all': [
        'Tid', 'Posen', 'Level', 
        'Squats_FE', 'Squats_TE', 
        'Advances_FE', 'Advances_TE', 
        'Sitting_FE', 'Sitting_TE', 
        'last_squats_train_level', 'last_advances_train_level', 'last_sitting_train_level'
    ],
    // *** Squats 篩選後所需的欄位 (符合您的要求) ***
    'squats': [
        'Tid', 'Posen', 'Level', 
        'Squats_FE', 'Squats_TE', 
        'last_squats_train_level'
    ],
    // *** Advances 篩選後所需的欄位 ***
    'advances': [
        'Tid', 'Posen', 'Level', 
        'Advances_FE', 'Advances_TE', 
        'last_advances_train_level'
    ],
    // *** Sitting 篩選後所需的欄位 ***
    'sitting': [
        'Tid', 'Posen', 'Level', 
        'Sitting_FE', 'Sitting_TE', 
        'last_sitting_train_level'
    ]
};
// 欄位標頭翻譯
const HEADER_MAP = {
  'Tid': '時間',
  'Posen': '訓練姿勢', // <--- 修正：將 Posen 的標頭改為「訓練姿勢」
  'Level': '訓練結果',
  'Squats_FE': '深蹲錯誤次數',
  'Squats_TE': '深蹲正確次數',
  'Advances_FE': '壺鈴錯誤次數',
  'Advances_TE': '壺鈴正確次數',
  'Sitting_FE': '坐姿錯誤次數',
  'Sitting_TE': '坐姿正確次數',
  'last_squats_train_level': '深蹲建議',
  'last_advances_train_level': '壺鈴建議',
  'last_sitting_train_level': '坐姿建議'
};

// 訓練姿勢 (Posen) 內容翻譯
const POSEN_TYPE_MAP = {
  'squats': '深蹲',
  'advances': '壺鈴',
  'sitting': '坐姿',
  'unknown': '未知',
};

// 訓練等級 (last_train_level) 內容翻譯
const SQUATS_LEVEL_MAP = {
  'lower': '扶椅深蹲',
  'middle': '座椅深蹲',
  'upper': '徒手深蹲',
  'upperPro': '進階徒手深蹲',
  'unknown': '未知',
};

// 壺鈴建議等級翻譯 (last_advances_train_level)
const ADVANCES_LEVEL_MAP = {
  'lower': '壺鈴站立提拉',
  'middle': '壺鈴提舉',
  'upper': '壺鈴高腳杯深蹲',
  'unknown': '未知',
};

// 坐姿建議等級翻譯 (last_sitting_train_level)
const SITTING_LEVEL_MAP = {
  'lower': '坐姿基礎',
  'middle': '坐姿中級',
  'upper': '坐姿高階',
  'unknown': '未知',
};

// 訓練結果 (Level) 翻譯
const LEVEL_MAP_RESULT = {
  'complete': '完成訓練',
  'promote_auto': '自動進階',
  'demote': '退階',
  'promote_option': '手動進階(待選)',
  'stopped': '中途停止'
};

// --- ↑↑↑ 翻譯對照表結束 ↑↑↑ ---


function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
        return { headers: [], rows: [] };
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);
    const rows = dataRows.map(line => {
        const values = line.split(',');
        const rowObject = headers.reduce((obj, header, index) => {
            obj[header] = values[index] ? values[index].trim() : '';
            return obj;
        }, {});
        
        return rowObject;
    });
    return { headers, rows };
}


/**
 * 核心篩選函式：根據選定的姿勢篩選資料並呼叫 renderTable
 * @param {string} exerciseType - 'all', 'squats', 'advances', 'sitting'
 */
function filterAndRender(exerciseType) {
    const data = ALL_TRAINING_DATA;
    let filteredRows = data.rows;
    
    // 1. 執行數據過濾
    if (exerciseType !== 'all') {
        const targetPosenValues = [exerciseType];
        
        // 為了向後兼容舊的 'lower', 'middle', 'upper' Posen 值，將其也納入篩選範圍
        if (exerciseType === 'squats') {
            targetPosenValues.push('lower', 'middle'); 
        } else if (exerciseType === 'advances') {
            targetPosenValues.push('upper', 'upperPro'); 
        }
        
        filteredRows = data.rows.filter(row => targetPosenValues.includes(row['Posen']));
    }

    // 2. 確定要顯示的欄位
    const displayHeaders = COLUMN_MAPS[exerciseType] || COLUMN_MAPS['all'];
    
    // 3. 渲染表格
    renderTable({ headers: data.headers, rows: filteredRows }, displayHeaders, exerciseType);
}


/**
 * 將解析後的資料動態渲染為 Bulma 表格 (現在接受 displayHeaders)
 */
function renderTable(data, displayHeaders, currentFilter) {
    const { rows } = data;
    const container = document.getElementById('data-container');

    if (!container) return;
    if (rows.length === 0) {
        showMesssage('is-warning', '無紀錄', `目前沒有找到符合「${HEADER_MAP[currentFilter] || currentFilter}」條件的訓練紀錄。`);
        return;
    }
    
    rows.reverse(); // 最新的在最上面

    // 1. 建立表格
    const table = document.createElement('table');
    table.className = 'table is-bordered is-striped is-narrow is-hoverable is-fullwidth';

    // 2. 建立表格標頭 (thead) - 套用翻譯，僅使用 displayHeaders
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    displayHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = HEADER_MAP[headerText] || headerText; 
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 3. 建立表格內容 (tbody) - 套用翻譯與樣式
    const tbody = document.createElement('tbody');
    rows.forEach(rowObject => {
        const tr = document.createElement('tr');
        
        // 只迭代需要顯示的欄位
        displayHeaders.forEach(header => {
            const td = document.createElement('td');
            const originalValue = rowObject[header] || '';

            let displayValue = originalValue;
            
            // --- 內容翻譯邏輯 ---
            if (header === 'Posen') {
                displayValue = POSEN_TYPE_MAP[originalValue] || originalValue;
            } else if (header.startsWith('last_')) {
                // 根據欄位名稱動態選擇翻譯表
                let levelMap = {};
                if (header === 'last_squats_train_level') {
                    levelMap = SQUATS_LEVEL_MAP;
                } else if (header === 'last_advances_train_level') {
                    levelMap = ADVANCES_LEVEL_MAP;
                } else if (header === 'last_sitting_train_level') {
                    levelMap = SITTING_LEVEL_MAP;
                }
                displayValue = levelMap[originalValue] || originalValue;
            } else if (header === 'Level') {
                displayValue = LEVEL_MAP_RESULT[originalValue] || originalValue;
            } else if (header === 'Tid') {
                 // 格式化時間：月/日 時:分
                 try {
                    displayValue = new Date(originalValue).toLocaleString('zh-TW', { 
                        month: '2-digit', day: '2-digit', 
                        hour: '2-digit', minute: '2-digit' 
                    });
                 } catch(e) { /* 保持原樣 */ }
            }
            
            td.textContent = displayValue;

            // --- 樣式設置 (簡化設置，使用 Posen 決定顏色) ---
            if (header === 'Level') {
                td.style.fontWeight = 'bold';
                // 根據 Posen 欄位設置整行背景色
                const posenType = rowObject['Posen'];
                if (posenType === 'squats' || posenType === 'lower' || posenType === 'middle') {
                    tr.style.backgroundColor = '#f4f6ff'; // 淺藍色 (深蹲)
                } else if (posenType === 'advances' || posenType === 'upper' || posenType === 'upperPro') {
                    tr.style.backgroundColor = '#fff6f4'; // 淺橘色 (壺鈴)
                } else if (posenType === 'sitting') {
                    tr.style.backgroundColor = '#e6ffe6'; // 淺綠色 (坐姿)
                }
            }
            if (header.endsWith('_FE') && originalValue && originalValue !== '0') {
                td.style.backgroundColor = '#ffe0e0'; // 錯誤次數非零時標註
            }
            if (header.endsWith('_FE') || header.endsWith('_TE')) {
                td.style.textAlign = 'center';
            }
            
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // 4. 將表格放入容器中
    container.innerHTML = '';
    container.appendChild(table);
}


/**
 * 輔助函式：顯示訊息
 * (保持不變)
 */
function showMesssage(type, title, text) {
    const msgBox = document.getElementById('message-box');
    const msgTitle = document.getElementById('message-title');
    const msgContent = document.getElementById('message-content');
    if (!msgBox || !msgTitle || !msgContent) return;
    
    msgBox.className = `message ${type}`;
    msgTitle.textContent = title;
    msgContent.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
    msgBox.style.display = 'block'; // 顯示訊息框
}


/**
 * 主函式：DOM 載入後執行
 */
document.addEventListener('DOMContentLoaded', async () => {
    const msgBox = document.getElementById('message-box');
    
    // 載入開始時顯示訊息
    showMesssage('is-info', '載入中...', '正在讀取 person.csv 檔案。');
    
    try {
        const urlWithCacheBuster = 'person.csv?t=' + Date.now();
        const response = await fetch(urlWithCacheBuster, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`讀取檔案失敗。 伺服器回應: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        // 儲存完整資料
        ALL_TRAINING_DATA = data; 

        // 預設篩選並渲染 'squats' 資訊 (或 'all'，取決於您的預設)
        filterAndRender('squats'); 
        
        // 載入成功後隱藏訊息
        msgBox.style.display = 'none';
        
    } catch (error) {
        console.error('讀取 CSV 失敗:', error);
        showMesssage('is-danger', '讀取失敗', `無法載入 person.csv。請確認檔案是否存在，以及後端伺服器 (server.js) 是否正在運行。 <br><small>${error.message}</small>`);
    }
    const filterSelect = document.getElementById('exercise-filter');
    if (filterSelect) {
        // 預設選中 'squats' 或 'all'，這裡預設選中 'all'
        filterSelect.value = 'all'; 

        // 綁定 change 事件，當使用者選擇不同項目時執行篩選
        filterSelect.addEventListener('change', (event) => {
            const selectedType = event.target.value;
            filterAndRender(selectedType);s
        });
    }

    // 初始載入時，呼叫 filterAndRender() 來顯示預設的 'all' 紀錄
    filterAndRender(filterSelect.value);

    // *** 提示：您需要在 HTML 中添加按鈕/選擇框，並呼叫 filterAndRender(type) 函式 ***
    // 範例：document.getElementById('squats-button').addEventListener('click', () => filterAndRender('squats'));
});