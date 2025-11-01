document.addEventListener('DOMContentLoaded', function () {
      var iframe = document.getElementById('content');

      // === Bulma navbar burger：手機展開/收合 ===
      var burger = document.querySelector('.navbar-burger');
      var menu = document.getElementById(burger ? burger.getAttribute('data-target') : '');
      if (burger && menu) {
        burger.addEventListener('click', function () {
          var active = burger.classList.toggle('is-active');
          menu.classList.toggle('is-active', active);
          burger.setAttribute('aria-expanded', String(active));
        });
      }

      // === 觸控裝置支援：點擊「訓練」可展開下拉 ===
      var training = document.getElementById('trainingDropdown');
      if (training) {
        var link = training.querySelector('.navbar-link');
        if (link) {
          link.addEventListener('click', function (e) {
            if (window.matchMedia('(hover: none)').matches) {
              e.preventDefault();
              training.classList.toggle('is-active');
            }
          });
        }
        // 點子項後自動收合
        var items = training.querySelectorAll('.navbar-dropdown .navbar-item');
        for (var i = 0; i < items.length; i++) {
          items[i].addEventListener('click', function () { training.classList.remove('is-active'); });
        }
      }

      // === 事件委派：點擊任何帶 data-src 的項目 → 載入到 iframe ===
      // --- ↓↓↓ 修改：將此函式改為 async 並加入判斷邏輯 ↓↓↓ ---
      document.addEventListener('click', function (e) { // 移除 async
        var t = e.target.closest ? e.target.closest('[data-src]') : null;

        // 排除帶有特殊 ID 的連結，避免與 squats_level.js 的邏輯衝突 (可選，但推薦)
        if (t && t.id === 'squat-training-link') return;

        if (!t) return;
        e.preventDefault();

        var next = t.getAttribute('data-src');
        if (!next) return;

        // 確保 iframe 元素存在
        if (!iframe) {
          console.error("iFrame 元素未定義！請檢查 ID 是否為 'content'");
          return;
        }

        // 高亮目前選項（可選）
        var links = document.querySelectorAll('[data-src]');
        for (var i = 0; i < links.length; i++) { links[i].classList.remove('is-primary'); }
        t.classList.add('is-primary');

        // 3. 使用 "next" (也就是 data-src 的值) 來載入 iframe
        // 使用 next 替換了錯誤的 targetUrl
        var url = new URL(next, window.location.href);
        var current = iframe.getAttribute('src');

        // 避免快取：如果 URL 相同，添加一個時間戳參數
        if (current && new URL(current, window.location.href).href === url.href) {
          url.searchParams.set('_', Date.now());
        }

        // 設置 iFrame 的 src，觸發載入
        iframe.setAttribute('src', url.toString());

        // 若是手機，點擊後自動收起 menu
        if (burger && menu && burger.classList.contains('is-active')) {
          burger.classList.remove('is-active');
          menu.classList.remove('is-active');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    (function () {
      try {
        // --- 1. DOM 元素獲取 ---
        var $gregorian = document.getElementById('gregorian');
        var $weekday = document.getElementById('weekday');
        var $time12 = document.getElementById('time12');
        var $period = document.getElementById('period');
        var $place = document.getElementById('place');
        var $temp = document.getElementById('temp');

        // --- 2. 時間日期 (本機) ---
        var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
        function periodLabel(h) {
          if (h >= 6 && h <= 11) return '上午';
          if (h === 12) return '中午';
          if (h >= 13 && h <= 16) return '下午';
          if (h >= 17 && h <= 18) return '傍晚';
          return '晚上';
        }
        function fmt12(h, m) {
          var h12 = h % 12 === 0 ? 12 : h % 12;
          return h12 + ':' + String(m).padStart(2, '0');
        }
        function tick() {
          try {
            var now = new Date();
            var y = now.getFullYear();
            var mo = String(now.getMonth() + 1).padStart(2, '0');
            var d = String(now.getDate()).padStart(2, '0');
            var w = WEEK[now.getDay()];
            var h = now.getHours();
            var m = now.getMinutes();
            if ($gregorian) $gregorian.textContent = y + '/' + mo + '/' + d;
            if ($weekday) $weekday.textContent = '星期' + w;
            if ($period) $period.textContent = periodLabel(h);
            if ($time12) $time12.textContent = fmt12(h, m);
          } catch (timeError) {
            console.error("tick() 函式錯誤:", timeError);
            if ($time12) $time12.textContent = "時間錯誤";
          }
        }
        tick(); // 立即執行
        setInterval(tick, 30 * 1000); // 每 30 秒更新

        // --- 3. 天氣與地點 (網路) ---
        function fetchJSON(url) {
          return fetch(url, {
            // *** 設定 8 秒超時 ***
            signal: AbortSignal.timeout(8000)
          }).then(function (r) {
            if (!r.ok) throw new Error('伺服器回應 ' + r.status);
            return r.json();
          });
        }

        function fetchPlaceName(lat, lon) {
          var url = 'https://geocoding.open-meteo.com/v1/reverse?latitude=' + lat + '&longitude=' + lon + '&language=zh-Hant&format=json';
          return fetchJSON(url).then(function (data) {
            if (data && data.results && data.results.length) {
              var r = data.results[0];
              var city = r.name || '';
              if ($place) $place.textContent = city;
            }
          }).catch(function (err) {
            console.warn("地點 API 失敗:", err.name, err.message);
            if ($place) $place.textContent = '地點無法顯示';
          });
        }

        function fetchWeather(lat, lon) {
          var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m&timezone=auto';
          return fetchJSON(url).then(function (data) {
            if (data && data.current && typeof data.current.temperature_2m === 'number') {
              if ($temp) $temp.textContent = Math.round(data.current.temperature_2m) + '°C';
            }
          }).catch(function (err) {
            console.warn("天氣 API 失敗:", err.name, err.message);
            if ($temp) $temp.textContent = '--°C';
          });
        }

        function usePosition(lat, lon) {
          fetchPlaceName(lat, lon);
          fetchWeather(lat, lon);
        }

        // --- 4. 啟動定位 ---
        var FALLBACK = { lat: 25.0375, lon: 121.5636 }; // 台北
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            function (pos) { usePosition(pos.coords.latitude, pos.coords.longitude); },
            function (geoError) {
              console.warn("GPS 定位失敗 (" + geoError.code + "): " + geoError.message);
              if ($place) $place.textContent = '使用預設地點';
              usePosition(FALLBACK.lat, FALLBACK.lon); // 定位失敗，使用預設值
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
          );
        } else {
          console.warn("瀏覽器不支援 Geolocation");
          if ($place) $place.textContent = '使用預設地點';
          usePosition(FALLBACK.lat, FALLBACK.lon); // 瀏覽器不支援，使用預設值
        }

      } catch (globalError) {
        // *** 捕獲任何意外的啟動錯誤 ***
        console.error("頁尾資訊腳本 (home.html) 發生嚴重錯誤:", globalError);
        document.body.insertAdjacentHTML('beforeend', '<p style="color:red; text-align:center;">頁尾腳本載入失敗，請檢查 Console。</p>');
      }
    })();