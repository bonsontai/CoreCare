 // --- ↓↓↓ 新增：中文翻譯對照表 ↓↓↓ ---
    
    // 欄位標頭翻譯
    const HEADER_MAP = {
        'Tid': '時間',
        'Posen': '訓練等級',
        'Level': '訓練結果',
        'FE': '錯誤次數',
        'TE': '正確次數',
        'last_squats_train_level': '下次等級建議'
    };
    
    // 訓練等級 (Posen / last_squats_train_level) 翻譯
    const POSEN_MAP = {
        'lower': '扶椅輔助 (Lower)',
        'middle': '座椅輔助 (Middle)',
        'upper': '徒手深蹲 (Upper)',
        'upperPro': '進階徒手 (UpperPro)',
        'unknown': '未知',
    };

    // 訓練結果 (Level) 翻譯
    const LEVEL_MAP = {
        'complete': '完成訓練',
        'demote': '退階',
        'promote_option': '可進階',
        'stopped': '中途停止'
    };
    
    // --- ↑↑↑ 翻譯對照表結束 ↑↑↑ ---


    /**
     * 將 CSV 純文字轉換為物件陣列
     * (此函式保持不變)
     */
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
     * 將解析後的資料動態渲染為 Bulma 表格
     * --- ↓↓↓ 已修改：加入翻譯邏輯 ↓↓↓ ---
     */
    function renderTable(data) {
      const { headers, rows } = data;
      const container = document.getElementById('data-container');

      if (!container) return;
      if (rows.length === 0) {
        showMesssage('is-info', '尚無紀錄', 'person.csv 中目前沒有任何訓練紀錄。');
        return;
      }
      
      rows.reverse(); // 最新的在最上面

      // 1. 建立表格
      const table = document.createElement('table');
      table.className = 'table is-bordered is-striped is-narrow is-hoverable is-fullwidth';

      // 2. 建立表格標頭 (thead) - 套用翻譯
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headers.forEach(headerText => {
        const th = document.createElement('th');
        // *** 修改點 1: 翻譯標頭 ***
        th.textContent = HEADER_MAP[headerText] || headerText; 
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // 3. 建立表格內容 (tbody) - 套用翻譯
      const tbody = document.createElement('tbody');
      rows.forEach(rowObject => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
          const td = document.createElement('td');
          const originalValue = rowObject[header] || '';

          // *** 修改點 2: 翻譯特定欄位的內容 ***
          let displayValue = originalValue;
          if (header === 'Posen' || header === 'last_squats_train_level') {
            displayValue = POSEN_MAP[originalValue] || originalValue;
          } else if (header === 'Level') {
            displayValue = LEVEL_MAP[originalValue] || originalValue;
          } else if (header === 'Tid') {
             // (可選) 格式化時間，使其更易讀
             try {
                displayValue = new Date(originalValue).toLocaleString('zh-TW', { 
                    year: 'numeric', month: '2-digit', day: '2-digit', 
                    hour: '2-digit', minute: '2-digit' 
                });
             } catch(e) { /* 保持原樣 */ }
          }
          
          td.textContent = displayValue;

          // (可選) 樣式
          if (header === 'FE' || header === 'TE') {
            td.style.textAlign = 'center';
          }
          if (header === 'Level') {
             td.style.fontWeight = 'bold';
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
     * (此函式保持不變)
     */
    function showMesssage(type, title, text) {
        const msgBox = document.getElementById('message-box');
        const msgTitle = document.getElementById('message-title');
        const msgContent = document.getElementById('message-content');
        if (!msgBox || !msgTitle || !msgContent) return;
        msgBox.className = `message ${type}`;
        msgTitle.textContent = title;
        msgContent.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
        msgBox.style.display = 'block';
    }

    /**
     * 主函式：DOM 載入後執行
     * (此函式保持不變)
     */
    document.addEventListener('DOMContentLoaded', async () => {
      const msgBox = document.getElementById('message-box');
      try {
        const response = await fetch('person.csv', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`讀取檔案失敗。 伺服器回應: ${response.status} ${response.statusText}`);
        }
        const csvText = await response.text();
        const data = parseCSV(csvText);
        renderTable(data);
        msgBox.style.display = 'none';
      } catch (error) {
        console.error('讀取 CSV 失敗:', error);
        showMesssage('is-danger', '讀取失敗', `無法載入 person.csv。請確認檔案是否存在，以及後端伺服器 (server.js) 是否正在運行。 <br><small>${error.message}</small>`);
      }
    });