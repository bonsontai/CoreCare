// --- 雷達圖專用腳本：包含計算與繪製邏輯 ---

// 這裡不再定義 COLUMN_MAPS, HEADER_MAP 等常數，它們將從 person.js 提供的全域作用域中取得

// 全域變數：用於儲存 Chart.js 實例，以便銷毀
let radarChartInstance = null;


/**
 * 將篩選後的資料聚合，並正規化為雷達圖所需的 4 個分數 (0-100)
 * @param {Array<Object>} filteredRows - 篩選後，僅包含目標姿勢的訓練紀錄
 * @param {string} exerciseType - 'squats', 'advances', or 'sitting'
 * @returns {Object} 包含分數和評估的數據物件
 */
function calculateRadarData(filteredRows, exerciseType) {
    console.log(`[RADAR-CALC] --- 開始計算 ${exerciseType} 數據 ---`);
    console.log(`[RADAR-CALC] 總共找到 ${filteredRows.length} 筆紀錄。`);

    if (filteredRows.length === 0) {
        console.log('[RADAR-CALC] 數據不足，分數皆為 0。');
        return { scores: [0, 0, 0, 0], evaluation: '無足夠數據進行評估。' };
    }

    let totalTE = 0;
    let totalFE = 0;
    let finishedSessions = 0;
    let successfulSessions = 0;
    let latestLevel = 'lower';

    // 1. 聚合數據
    filteredRows.forEach(row => {
        let feKey = '';
        let teKey = '';
        if (exerciseType === 'squats' || row['Posen'] === 'lower' || row['Posen'] === 'middle') {
            feKey = 'Squats_FE'; teKey = 'Squats_TE';
        } else if (exerciseType === 'advances' || row['Posen'] === 'upper' || row['Posen'] === 'upperPro') {
            feKey = 'Advances_FE'; teKey = 'Advances_TE';
        } else if (exerciseType === 'sitting') {
            feKey = 'Sitting_FE'; teKey = 'Sitting_TE';
        }

        const fe = parseInt(row[feKey]) || 0;
        const te = parseInt(row[teKey]) || 0;

        totalTE += te;
        totalFE += fe;

        if (row['Level'] !== 'stopped' && row['Level'] !== '') {
            finishedSessions++;
            if (row['Level'] === 'promote_auto' || row['Level'] === 'complete') {
                successfulSessions++;
            }
        }

        // 這裡假設 person.js 中的 SQUATS_LEVEL_MAP 等變數在全域是可用的
        if (row[`last_${exerciseType}_train_level`]) {
            latestLevel = row[`last_${exerciseType}_train_level`];
        }
    });

    console.log(`[RADAR-CALC] 聚合結果: 總成功次數(TE): ${totalTE}, 總錯誤次數(FE): ${totalFE}`);
    console.log(`[RADAR-CALC] 總完成訓練回合: ${finishedSessions}, 成功晉級回合: ${successfulSessions}`);
    console.log(`[RADAR-CALC] 最新建議等級: ${latestLevel}`);


    // 2. 正規化分數 (Mapping Scores)
    const accuracy = (totalTE + totalFE > 0) ? (totalTE / (totalTE + totalFE)) * 100 : 0;
    const levelMap = { 'lower': 25, 'middle': 50, 'upper': 75, 'upperPro': 100 };
    const mastery = levelMap[latestLevel] || 0;
    const consistency = (finishedSessions > 0) ? (successfulSessions / finishedSessions) * 100 : 0;
    const TOTAL_GOAL = 100;
    const commitment = Math.min((totalTE / TOTAL_GOAL) * 100, 100);

    console.log(`[RADAR-CALC] 分數結果: 準確度(${accuracy.toFixed(1)}%), 掌握度(${mastery}%), 穩定性(${consistency.toFixed(1)}%), 投入度(${commitment.toFixed(1)}%)`);


    // 3. 狀態評估
    const scores = [accuracy, mastery, consistency, commitment];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);

    let evaluationText = '';
    if (minScore > 75) {
        evaluationText = '狀態：優秀，訓練全面且穩定。';
    } else if (avgScore > 60 && minScore > 40) {
        evaluationText = '狀態：良好，進展穩健，可挑戰進階。';
    } else if (minScore < 30) {
        const lowMetric = ['準確度', '掌握度', '穩定性', '投入度'][scores.indexOf(minScore)];
        evaluationText = `狀態：需加強，當前瓶頸為 ${lowMetric}。`;
    } else {
        evaluationText = '狀態：一般，持續努力，保持平衡訓練。';
    }

    console.log(`[RADAR-CALC] 評估結果: ${evaluationText}`);

    return { scores: scores, evaluation: evaluationText };
}


/**
 * 使用 Chart.js 繪製雷達圖 (公開給 person.js 呼叫)
 */
function renderRadarChart(scores, evaluationText) {
    console.log('[RADAR-DRAW] 開始繪製雷達圖...');
    const chartContainer = document.getElementById('radar-chart-container');
    const evaluationElement = document.getElementById('radar-evaluation');

    if (!chartContainer || scores.length === 0 || scores.every(s => s === 0)) {
        chartContainer.style.display = 'none';
        console.log('[RADAR-DRAW] 退出繪製：圖表容器或數據無效。');
        return;
    }

    chartContainer.style.display = 'block';
    evaluationElement.textContent = evaluationText;

    // 1. 找到 canvas 所在的父容器 (chart-wrapper)
    let parentNode = chartContainer.querySelector('.chart-wrapper') || chartContainer;
    let oldCanvas = document.getElementById('radarChart');

    // 2. 銷毀舊實例
    if (radarChartInstance) {
        radarChartInstance.destroy();
        radarChartInstance = null;
        console.log('[RADAR-DRAW] 舊圖表實例已銷毀。');
    }

    // 3. 移除舊的 canvas (這是防止擠壓的關鍵動作)
    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
        console.log('[RADAR-DRAW] 舊 Canvas 元素已從 DOM 移除。');
    }

    // 4. 創建一個全新的 canvas 元素
    let newCanvas = document.createElement('canvas');
    newCanvas.id = 'radarChart';

    // 5. 插入回容器中
    parentNode.appendChild(newCanvas);
    console.log('[RADAR-DRAW] 已插入新 Canvas 元素。');

    const ctx = newCanvas;

    const data = {
        labels: [
            '姿勢準確度 (Accuracy)',
            '等級掌握度 (Mastery)',
            '穩定性分數 (Consistency)',
            '總體投入度 (Commitment)'
        ],
        datasets: [{
            label: '綜合評估分數',
            data: scores,
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgb(54, 162, 235)',
            pointBackgroundColor: 'rgb(54, 162, 235)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(54, 162, 235)'
        }]
    };

    const config = {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                line: {
                    borderWidth: 3
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: false
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    pointLabels: {
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        stepSize: 25,
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + context.parsed.r.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    };

    radarChartInstance = new Chart(ctx, config);
    console.log('[RADAR-DRAW] 圖表繪製完成！');
}