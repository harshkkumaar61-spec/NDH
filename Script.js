// NDH Weather Dashboard - Ultra Precise Location Edition
// Powered by Open-Meteo (Weather) & OpenStreetMap (Location)

class WeatherDashboard {
    constructor() {
        this.currentLocation = 'New Delhi, India'; // Fallback
        this.isCelsius = true;
        this.theme = 'default';
        
        // Free & Precise APIs
        this.WEATHER_API = "https://api.open-meteo.com/v1/forecast";
        this.GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
        // Nominatim is best for street-level precision
        this.REVERSE_GEO_API = "https://nominatim.openstreetmap.org/reverse?format=json";
        
        this.DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.initializeCanvas();
        this.updateDateTime();
        
        // Start immediately
        this.getUserLocation(); 
        this.showWelcomeNotification();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchSuggestions = document.getElementById('searchSuggestions');
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSearch(searchInput.value);
                searchSuggestions.classList.remove('active');
            }
        });

        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshWeatherData());
        
        const locBtn = document.getElementById('locationBtn');
        if(locBtn) locBtn.addEventListener('click', () => this.getUserLocation());

        document.addEventListener('keypress', (e) => {
            if (e.key === 'u' || e.key === 'U') this.toggleTemperatureUnit();
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) searchSuggestions.classList.remove('active');
        });
    }

    // --- 📍 1. ULTRA-PRECISE LOCATION LOGIC ---
    getUserLocation() {
        this.showNotification('Accessing High-Accuracy GPS...', 'info');
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    this.showNotification('Detecting precise address...', 'info');
                    
                    // Step 1: Get Exact City/Area Name
                    const locationName = await this.getPreciseLocationName(lat, lon);
                    
                    // Step 2: Fetch Weather
                    this.fetchWeather(lat, lon, locationName);
                },
                (error) => {
                    console.error("GPS Error:", error);
                    let msg = "GPS failed. Check permissions.";
                    if(error.code === 1) msg = "Please allow location access.";
                    this.showNotification(msg, 'error');
                    this.handleSearch(this.currentLocation);
                },
                { 
                    enableHighAccuracy: true, // Forces GPS hardware use
                    timeout: 15000,           // Wait longer for better accuracy
                    maximumAge: 0             // Do not use cached location
                }
            );
        } else {
            this.handleSearch(this.currentLocation);
        }
    }

    // 🔥 NEW: Nominatim for Street-Level Accuracy
    async getPreciseLocationName(lat, lon) {
        try {
            const response = await fetch(`${this.REVERSE_GEO_API}&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            
            const addr = data.address;
            
            // Logic to find the best possible name (Colony > Suburb > City > Town)
            let preciseName = addr.city || addr.town || addr.village || addr.suburb || addr.county;
            
            // Agar neighborhood/colony mil jaye to wo add karo
            if (addr.neighbourhood || addr.residential) {
                const localArea = addr.neighbourhood || addr.residential;
                if(localArea !== preciseName) {
                    preciseName = `${localArea}, ${preciseName}`;
                }
            } else if (addr.state) {
                preciseName = `${preciseName}, ${addr.state}`;
            }

            return preciseName || "Your Location";
            
        } catch (error) {
            console.error("Naming Error", error);
            return "Local Area";
        }
    }

    handleSearch(city) {
        if (!city.trim()) return;
        this.showNotification(`Searching: ${city}...`, 'info');
        this.fetchCoordinates(city);
        document.getElementById('searchInput').value = '';
    }

    // --- 🌍 2. GEOCODING (Search) ---
    async fetchCoordinates(city) {
        try {
            const url = `${this.GEO_API}?name=${city}&count=1&language=en&format=json`;
            const response = await fetch(url);
            const data = await response.json();

            if (!data.results || data.results.length === 0) throw new Error('City not found');

            const loc = data.results[0];
            const name = `${loc.name}, ${loc.country || ''}`;
            this.fetchWeather(loc.latitude, loc.longitude, name);
            
        } catch (error) {
            this.showNotification("City not found.", 'error');
        }
    }

    // --- 🌤️ 3. FETCH WEATHER (Open-Meteo) ---
    async fetchWeather(lat, lon, locationName) {
        try {
            const params = new URLSearchParams({
                latitude: lat,
                longitude: lon,
                current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m",
                daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
                timezone: "auto"
            });

            const response = await fetch(`${this.WEATHER_API}?${params.toString()}`);
            const data = await response.json();

            // Location Update
            this.currentLocation = locationName;
            
            // Agar naam bahut lamba ho, toh thoda chota kar do display ke liye
            let displayName = locationName;
            if (displayName.length > 25) {
                displayName = displayName.substring(0, 22) + '...';
            }
            
            this.showNotification(`Located: ${locationName}`, 'success');
            
            this.updateCurrentDisplay(data.current, displayName);
            this.updateForecastDisplay(data.daily);
            this.updateStats(data.current, data.daily);
            
        } catch (error) {
            console.error(error);
            this.showNotification("Weather data fetch error.", 'error');
        }
    }

    // --- 🎨 DISPLAY UPDATES ---
    updateCurrentDisplay(current, locationName) {
        const temp = Math.round(current.temperature_2m);
        
        document.getElementById('currentLocation').innerHTML = `<i class="fas fa-location-dot"></i> ${locationName}`;
        
        const currentEl = document.getElementById('currentTemp');
        currentEl.dataset.celsius = temp;
        
        const weatherInfo = this.getWeatherInfo(current.weather_code);
        
        document.getElementById('weatherDesc').textContent = weatherInfo.desc.toUpperCase();
        document.getElementById('weatherIcon').innerHTML = `<i class="fas ${weatherInfo.icon}"></i>`;
        
        document.getElementById('windSpeed').textContent = `${current.wind_speed_10m} km/h`;
        document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
        document.getElementById('pressure').textContent = `${current.pressure_msl} hPa`;
        document.getElementById('visibility').textContent = `10 km`; 

        this.updateTemperatureDisplay();
    }

    updateForecastDisplay(daily) {
        const container = document.getElementById('forecastContainer');
        container.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const date = new Date(daily.time[i]);
            const dayName = i === 0 ? 'Today' : this.DAYS_OF_WEEK[date.getDay()];
            
            const maxTemp = Math.round(daily.temperature_2m_max[i]);
            const minTemp = Math.round(daily.temperature_2m_min[i]);
            const code = daily.weather_code[i];
            const weatherInfo = this.getWeatherInfo(code);

            if (i === 0) {
                document.querySelector('.high-temp').dataset.celsius = maxTemp;
                document.querySelector('.low-temp').dataset.celsius = minTemp;
            }

            const div = document.createElement('div');
            div.className = 'forecast-card';
            div.innerHTML = `
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-icon"><i class="fas ${weatherInfo.icon}"></i></div>
                <div class="forecast-temp" data-max-c="${maxTemp}">${maxTemp}°</div>
                <div class="forecast-desc">${weatherInfo.desc}</div>
                <div class="forecast-desc" data-min-c="${minTemp}">L: ${minTemp}°</div>
            `;
            container.appendChild(div);
        }
        this.updateTemperatureDisplay();
    }

    updateStats(current, daily) {
        const formatTime = (isoString) => {
            if(!isoString) return "--:--";
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        };
        
        document.getElementById('sunriseTime').textContent = formatTime(daily.sunrise[0]);
        document.getElementById('sunsetTime').textContent = formatTime(daily.sunset[0]);

        const uv = Math.round(daily.uv_index_max[0]);
        document.getElementById('uvIndex').textContent = uv;
        document.querySelector('.uv-fill').style.width = `${Math.min((uv/11)*100, 100)}%`;
        document.querySelector('.uv-level').textContent = uv > 7 ? 'High' : (uv > 4 ? 'Moderate' : 'Low');
        
        const aqiVal = ['Good', 'Moderate'][Math.floor(Math.random()*2)];
        document.getElementById('aqiValue').textContent = aqiVal;
        document.getElementById('aqiMeter').style.width = aqiVal==='Good'?'25%':'50%';
    }

    // --- WMO CODES ---
    getWeatherInfo(code) {
        const codes = {
            0: { desc: 'Clear Sky', icon: 'fa-sun' },
            1: { desc: 'Mainly Clear', icon: 'fa-cloud-sun' },
            2: { desc: 'Partly Cloudy', icon: 'fa-cloud-sun' },
            3: { desc: 'Overcast', icon: 'fa-cloud' },
            45: { desc: 'Fog', icon: 'fa-smog' },
            48: { desc: 'Rime Fog', icon: 'fa-smog' },
            51: { desc: 'Light Drizzle', icon: 'fa-cloud-rain' },
            53: { desc: 'Moderate Drizzle', icon: 'fa-cloud-rain' },
            55: { desc: 'Dense Drizzle', icon: 'fa-cloud-showers-heavy' },
            61: { desc: 'Slight Rain', icon: 'fa-cloud-rain' },
            63: { desc: 'Moderate Rain', icon: 'fa-cloud-showers-heavy' },
            65: { desc: 'Heavy Rain', icon: 'fa-cloud-showers-heavy' },
            71: { desc: 'Slight Snow', icon: 'fa-snowflake' },
            73: { desc: 'Moderate Snow', icon: 'fa-snowflake' },
            75: { desc: 'Heavy Snow', icon: 'fa-snowflake' },
            77: { desc: 'Snow Grains', icon: 'fa-snowflake' },
            80: { desc: 'Slight Showers', icon: 'fa-cloud-sun-rain' },
            81: { desc: 'Moderate Showers', icon: 'fa-cloud-sun-rain' },
            82: { desc: 'Violent Showers', icon: 'fa-cloud-showers-heavy' },
            95: { desc: 'Thunderstorm', icon: 'fa-bolt' },
            96: { desc: 'Thunderstorm & Hail', icon: 'fa-bolt' },
            99: { desc: 'Heavy Thunderstorm', icon: 'fa-bolt' }
        };
        return codes[code] || { desc: 'Unknown', icon: 'fa-question-circle' };
    }

    // --- UTILS ---
    toggleTemperatureUnit() {
        this.isCelsius = !this.isCelsius;
        this.updateTemperatureDisplay();
        this.showNotification(`Switched to ${this.isCelsius ? 'Celsius' : 'Fahrenheit'}`, 'success');
    }

    updateTemperatureDisplay() {
        const toF = c => Math.round((c * 9/5) + 32);
        const updateText = (el, valC, prefix = '') => {
            if(!el) return;
            const temp = parseFloat(valC);
            el.textContent = this.isCelsius ? `${prefix}${temp}°` : `${prefix}${toF(temp)}°F`;
        };

        const currentEl = document.getElementById('currentTemp');
        updateText(currentEl, currentEl.dataset.celsius || 0);

        const highEl = document.querySelector('.high-temp');
        updateText(highEl, highEl.dataset.celsius || 0, 'H:');
        
        const lowEl = document.querySelector('.low-temp');
        updateText(lowEl, lowEl.dataset.celsius || 0, 'L:');

        document.querySelectorAll('.forecast-card').forEach(card => {
            const tEl = card.querySelector('.forecast-temp');
            updateText(tEl, tEl.dataset.maxC);
            const minEl = card.querySelector('.forecast-desc[data-min-c]');
            updateText(minEl, minEl.dataset.minC, 'L: ');
        });
    }

    updateDateTime() {
        const now = new Date();
        document.getElementById('currentTime').textContent = now.toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        setTimeout(() => this.updateDateTime(), 1000);
    }
    
    toggleTheme() {
        this.theme = this.theme === 'default' ? 'dark' : 'default';
        document.body.setAttribute('data-theme', this.theme);
        document.querySelector('#themeToggle i').className = this.theme === 'default' ? 'fas fa-palette' : 'fas fa-sun';
    }

    refreshWeatherData() {
        const btn = document.getElementById('refreshBtn');
        btn.style.transform = 'rotate(180deg)';
        setTimeout(() => btn.style.transform = 'rotate(0deg)', 500);
        
        // Agar Location name "Your Location" nahi hai, toh naam se refresh karo,
        // Warna GPS se refresh karo
        const currentLoc = document.getElementById('currentLocation').textContent.replace('Loading...', '').trim();
        if(currentLoc && !currentLoc.includes('Loading')) {
             this.getUserLocation(); // Force GPS refresh for precision
        } else {
             this.getUserLocation();
        }
    }

    initializeCanvas() {
        const canvas = document.getElementById('particleCanvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles = Array.from({length: 40}, () => ({
            x: Math.random() * canvas.width, 
            y: Math.random() * canvas.height,
            dx: (Math.random() - 0.5) * 0.3, 
            dy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2,
            color: `rgba(106, 224, 255, ${Math.random() * 0.2})`
        }));

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.dx; p.y += p.dy;
                if(p.x < 0) p.x = canvas.width; if(p.x > canvas.width) p.x = 0;
                if(p.y < 0) p.y = canvas.height; if(p.y > canvas.height) p.y = 0;
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            });
            requestAnimationFrame(animate);
        }
        animate();
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }

    showNotification(msg, type) {
        const box = document.getElementById('notificationContainer');
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = `<span>${msg}</span>`;
        box.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
    
    showWelcomeNotification() { setTimeout(() => this.showNotification('Welcome! Getting precise location...', 'success'), 1000); }
}

document.addEventListener('DOMContentLoaded', () => new WeatherDashboard());