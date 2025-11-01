const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const csvPath = path.join(__dirname, 'person.csv');

// --- 中介軟體 (Middleware) ---

// 1. 處理 CORS 跨來源問題
// 允許所有來源 (但建議在正式環境中限制來源)
app.use(cors()); 

// 2. 處理 JSON 請求體
app.use(express.json());

// --- 路由定義 ---

// POST /save-data: 接收前端傳來的訓練資料
app.post('/save-data', (req, res) => {
    const data = req.body;

    if (!data || !data.Tid || !data.Posen || data.Level === undefined) {
        return res.status(400).json({ success: false, message: '請求資料格式不完整。' });
    }

    // 由於您的 CSV 是表格式，我們需要將 JSON 轉換為 CSV 行
    // 欄位順序: Tid, Posen, Level, FE, TE, last_squats_train_level (NextPosen)
    const newCsvLine = [
        data.Tid,
        data.Posen,
        data.Level,
        data.FE,
        data.TE,
        data.NextPosen || '' // NextPosen 就是您要儲存的 last_squats_train_level
    ].join(',');

    // 換行符號
    const lineWithNewLine = newCsvLine + '\n';
    
    // 將資料追加寫入 person.csv 檔案
    // fs.appendFile: 異步追加檔案內容
    fs.appendFile(csvPath, lineWithNewLine, (err) => {
        if (err) {
            console.error('寫入 person.csv 失敗:', err);
            return res.status(500).json({ success: false, message: '伺服器儲存資料失敗。' });
        }
        
        console.log(`[寫入成功] 新增訓練紀錄: ${data.Level} -> ${data.NextPosen}`);
        res.json({ success: true, message: '訓練資料已成功儲存。' });
    });
});

// --- 伺服器啟動 ---
app.listen(port, () => {
    console.log(`Node.js 伺服器已啟動，監聽端口: ${port}`);
    console.log(`API 終點: http://localhost:${port}/save-data`);
});
