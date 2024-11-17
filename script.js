import Chart from 'chart.js/auto';

const BASE_URL = 'https://api.binance.com/api/v3';
let chart = null;
let analysisInterval = null;
let isLiveAnalysis = false;
let priceUpdateInterval = null;

let filters = {
    lowerTail: 0,
    upperTail: 0,
    enableLowerTail: false,
    enableUpperTail: false
};

// Event Handlers
function handleFormSubmit(e) {
    e.preventDefault();
    updateFilters();
    if (!isLiveAnalysis) {
        fetchCurrencyData();
    }
}

function updateFilters() {
    filters = {
        lowerTail: parseFloat(document.getElementById('lower-tail').value) || 0,
        upperTail: parseFloat(document.getElementById('upper-tail').value) || 0,
        enableLowerTail: document.getElementById('enable-lower-tail').checked,
        enableUpperTail: document.getElementById('enable-upper-tail').checked
    };
}

function toggleLiveAnalysis() {
    const liveToggle = document.getElementById('live-toggle');
    const stopButton = document.getElementById('stop-analysis');
    const submitButton = document.querySelector('.submit-btn');
    
    isLiveAnalysis = !isLiveAnalysis;
    
    if (isLiveAnalysis) {
        liveToggle.classList.remove('inactive');
        liveToggle.querySelector('.status-indicator').classList.remove('inactive');
        liveToggle.querySelector('.status-indicator').classList.add('active');
        stopButton.style.display = 'inline-block';
        submitButton.style.display = 'none';
        
        updateFilters();
        fetchCurrencyData();
        analysisInterval = setInterval(fetchCurrencyData, 5000);
    } else {
        stopAnalysis();
    }
}

function stopAnalysis() {
    const liveToggle = document.getElementById('live-toggle');
    const stopButton = document.getElementById('stop-analysis');
    const submitButton = document.querySelector('.submit-btn');
    
    isLiveAnalysis = false;
    clearInterval(analysisInterval);
    
    liveToggle.classList.add('inactive');
    liveToggle.querySelector('.status-indicator').classList.remove('active');
    liveToggle.querySelector('.status-indicator').classList.add('inactive');
    stopButton.style.display = 'none';
    submitButton.style.display = 'inline-block';
}

async function fetchCurrencyData() {
    try {
        const response = await fetch(`${BASE_URL}/ticker/24hr`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const filteredCurrencies = data
            .filter(currency => currency.symbol.endsWith('USDT'))
            .filter(checkTailConditions)
            .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));

        if (filteredCurrencies.length === 0) {
            document.querySelector('#currency-table tbody').innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center;">لا توجد عملات تطابق المعايير المحددة</td>
                </tr>
            `;
            if (chart) {
                chart.destroy();
                chart = null;
            }
        } else {
            updateCurrencyTable(filteredCurrencies);
            updateChart(filteredCurrencies);
        }
    } catch (error) {
        console.error('خطأ في جلب البيانات:', error.message);
        document.querySelector('#currency-table tbody').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--danger-color);">
                    حدث خطأ أثناء جلب البيانات. الرجاء المحاولة مرة أخرى لاحقاً.
                </td>
            </tr>
        `;
        if (chart) {
            chart.destroy();
            chart = null;
        }
        stopAnalysis();
    }
}

function checkTailConditions(currency) {
    try {
        const price = parseFloat(currency.lastPrice);
        const lowPrice = parseFloat(currency.lowPrice);
        const highPrice = parseFloat(currency.highPrice);
        
        if (isNaN(price) || isNaN(lowPrice) || isNaN(highPrice)) {
            return false;
        }

        let valid = true;

        if (filters.enableLowerTail) {
            const lowerTailPercentage = ((price - lowPrice) / price) * 100;
            valid = valid && !isNaN(lowerTailPercentage) && (lowerTailPercentage >= filters.lowerTail);
        }

        if (filters.enableUpperTail) {
            const upperTailPercentage = ((highPrice - price) / price) * 100;
            valid = valid && !isNaN(upperTailPercentage) && (upperTailPercentage >= filters.upperTail);
        }

        return valid;
    } catch (error) {
        console.error('خطأ في حساب الشروط:', error);
        return false;
    }
}

function updateCurrencyTable(currencies) {
    const tbody = document.querySelector('#currency-table tbody');
    tbody.innerHTML = '';

    currencies.forEach(currency => {
        try {
            const row = document.createElement('tr');
            const priceChange = parseFloat(currency.priceChangePercent);
            const recommendation = priceChange > 0 ? 'شراء 🚀' : 'بيع 🔻';
            
            const timestamp = new Date().toLocaleString('ar-DZ', {
                timeZone: 'Africa/Algiers',
                hour12: false
            });

            row.innerHTML = `
                <td>${currency.symbol}</td>
                <td>${parseFloat(currency.lastPrice).toFixed(6)}</td>
                <td>${parseFloat(currency.volume).toFixed(2)}</td>
                <td>${timestamp}</td>
                <td style="color: ${priceChange > 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${recommendation}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="window.open('https://www.binance.com/ar/trade/${currency.symbol}?type=spot', '_blank')" title="تداول على Binance">
                            💱
                        </button>
                        ${priceChange > 0 ? `
                            <button class="action-btn" onclick="showTradingInfo('${currency.symbol}')" title="عرض توصيات التداول">
                                📊
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        } catch (error) {
            console.error('خطأ في تحديث الجدول:', error);
        }
    });
}

function updateChart(currencies) {
    try {
        const ctx = document.getElementById('currency-chart').getContext('2d');
        
        if (chart) {
            chart.destroy();
        }

        const topCurrencies = currencies.slice(0, 10);

        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topCurrencies.map(c => c.symbol),
                datasets: [{
                    label: 'حجم التداول',
                    data: topCurrencies.map(c => parseFloat(c.volume)),
                    backgroundColor: 'rgba(74, 144, 226, 0.5)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'var(--text-color)'
                        }
                    },
                    title: {
                        display: true,
                        text: 'أعلى 10 عملات من حيث حجم التداول',
                        color: 'var(--text-color)'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('خطأ في تحديث الرسم البياني:', error);
    }
}

// Trading Info Modal
window.showTradingInfo = async function(symbol) {
    const modal = document.getElementById('trading-modal');
    const symbolElement = document.getElementById('modal-symbol');
    const livePriceElement = document.getElementById('live-price');
    const priceTargetsElement = document.getElementById('price-targets');
    const currencyInfoElement = document.getElementById('currency-info');

    symbolElement.textContent = symbol;
    modal.classList.add('active');

    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }

    async function updatePrice() {
        try {
            const response = await fetch(`${BASE_URL}/ticker/price?symbol=${symbol}`);
            const data = await response.json();
            const price = parseFloat(data.price).toFixed(6);
            livePriceElement.textContent = `السعر الحالي: ${price} USDT`;

            const currentPrice = parseFloat(data.price);
            const target1 = (currentPrice * 1.01).toFixed(6);
            const target2 = (currentPrice * 1.02).toFixed(6);
            const target3 = (currentPrice * 1.03).toFixed(6);
            const stopLoss = (currentPrice * 0.99).toFixed(6);

            priceTargetsElement.innerHTML = `
                <div class="price-target">
                    <span>الهدف الأول 🎯</span>
                    <span>${target1}</span>
                </div>
                <div class="price-target">
                    <span>الهدف الثاني 🎯</span>
                    <span>${target2}</span>
                </div>
                <div class="price-target">
                    <span>الهدف الثالث 🎯</span>
                    <span>${target3}</span>
                </div>
                <div class="price-target" style="color: var(--danger-color)">
                    <span>وقف الخسارة 🛑</span>
                    <span>${stopLoss}</span>
                </div>
            `;
        } catch (error) {
            console.error('خطأ في تحديث السعر:', error);
        }
    }

    await updatePrice();
    priceUpdateInterval = setInterval(updatePrice, 1000);
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('filters-form');
    const liveToggle = document.getElementById('live-toggle');
    const stopButton = document.getElementById('stop-analysis');
    const refreshButton = document.getElementById('refresh-data');
    const modal = document.getElementById('trading-modal');
    const closeModal = document.getElementById('close-modal');

    form.addEventListener('submit', handleFormSubmit);
    liveToggle.addEventListener('click', toggleLiveAnalysis);
    stopButton.addEventListener('click', stopAnalysis);
    refreshButton.addEventListener('click', fetchCurrencyData);
    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        clearInterval(priceUpdateInterval);
    });

    fetchCurrencyData();
});