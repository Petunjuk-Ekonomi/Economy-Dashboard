let charts = {};
let mbccInterval; 

const compTheme = { 'COINCIDENT INDEX': '#4A3B32', 'LAGGING INDEX': '#829368', 'LEADING INDEX': '#D4A373' };
const cafePalette = ['#D4A373', '#829368', '#4A3B32', '#E29578', '#A3B18A', '#B5838D', '#E5989B', '#6D6875', '#E5C0A1'];

// ==========================================
// 1. DARK MODE SYSTEM
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    const icon = document.querySelector('#themeToggle i');

    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        if(icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
    }
}

function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('#themeToggle i');
    body.classList.toggle('dark-mode');
    
    let theme = 'light';
    if (body.classList.contains('dark-mode')) {
        theme = 'dark';
        icon.classList.remove('fa-moon'); icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun'); icon.classList.add('fa-moon');
    }
    localStorage.setItem('theme', theme);

    updateChartColors();
}

function updateChartColors() {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#EAEAEA' : '#4A3B32';
    const gridColor = isDark ? '#333333' : '#EAE6DF';

    Chart.defaults.color = textColor;
    
    for (let id in charts) {
        if(charts[id].options.scales) {
            if(charts[id].options.scales.x) {
                charts[id].options.scales.x.ticks.color = textColor;
                charts[id].options.scales.x.title.color = textColor;
                charts[id].options.scales.x.grid.color = gridColor;
            }
            if(charts[id].options.scales.y) {
                charts[id].options.scales.y.ticks.color = textColor;
                charts[id].options.scales.y.title.color = textColor;
                charts[id].options.scales.y.grid.color = gridColor;
            }
        }
        if(charts[id].options.plugins.legend) {
            charts[id].options.plugins.legend.labels.color = textColor;
        }
        charts[id].update();
    }
}

// ==========================================
// 2. UI HELPERS (Dropdowns, Modals)
// ==========================================
function toggleDrop(id) { document.getElementById(id).classList.toggle("show"); }

window.onclick = function(event) {
    if (!event.target.matches('.drop-btn') && !event.target.closest('.drop-content')) {
        let dropdowns = document.getElementsByClassName("drop-content");
        for (let i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) dropdowns[i].classList.remove('show');
        }
    }
    let modal = document.getElementById('infoModal');
    if (event.target === modal) closeModal();
}

function handleAll(className, checkbox) {
    let checks = document.getElementsByClassName(className);
    if(checkbox.checked) {
        for(let i=0; i<checks.length; i++) if(checks[i] !== checkbox) checks[i].checked = false;
    }
}
function uncheckAll(className) {
    let checks = document.getElementsByClassName(className);
    for(let i=0; i<checks.length; i++) if(checks[i].value === 'All') checks[i].checked = false;
}
function getCheckedValues(className) {
    let checks = document.getElementsByClassName(className);
    let values = [];
    for(let i=0; i<checks.length; i++) if(checks[i].checked) values.push(checks[i].value);
    
    return values.length === 0 ? 'All' : values.join('|');
}

function resetFilters(page) {
    let prefix = (page === 'cmp') ? 'cmp-' : (page === 'mbcc') ? 'mbcc-' : '';
    const filterTypes = ['year', 'month', 'index', 'comp'];
    filterTypes.forEach(type => {
        let checks = document.getElementsByClassName(`${prefix}${type}-check`);
        if (checks.length > 0) { for(let i=0; i<checks.length; i++) checks[i].checked = (checks[i].value === 'All'); }
    });
    if (page === 'comp') loadComposite();
    else if (page === 'cmp') loadComponent();
    else if (page === 'mbcc') loadMBCC();
}

// MODAL LOGIC
function openModal(imageSrc) {
    document.getElementById('modalImage').src = `/static/${imageSrc}`;
    document.getElementById('infoModal').classList.add('show');
}
function closeModal() {
    document.getElementById('infoModal').classList.remove('show');
    document.getElementById('modalImage').src = "";
}

// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    initTheme(); 
    
    const isDark = document.body.classList.contains('dark-mode');
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.color = isDark ? '#EAEAEA' : '#4A3B32';
    
    if(document.getElementById('cIndexChart')) loadComposite();
    else if (document.getElementById('cmpIndexChart')) loadComponent();
    else if (document.getElementById('mbccChart')) loadMBCC();
});

function destroyChart(name) { if (charts[name]) charts[name].destroy(); }

function getCommonOptions(yTitle) {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#EAEAEA' : '#4A3B32';
    const gridColor = isDark ? '#333333' : '#EAE6DF';

    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', align: 'start', labels: { usePointStyle: true, boxWidth: 6, color: textColor, font: {weight: '600'} } },
            tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#fff', bodyColor: '#fff', cornerRadius: 8 }
        },
        scales: {
            x: { title: { display: true, text: 'Month', font: { weight: '600' }, color: textColor }, ticks:{color: textColor}, grid: { display: false } },
            y: { title: { display: true, text: yTitle, font: { weight: '600' }, color: textColor }, ticks:{color: textColor}, grid: { color: gridColor, borderDash: [5, 5] } }
        },
        interaction: { mode: 'index', intersect: false }
    };
}

function setupLineDataset(dataset, color) {
    dataset.borderColor = color; dataset.fill = false; dataset.tension = 0;
    dataset.borderJoinStyle = 'round'; dataset.borderWidth = 2.5;
    dataset.pointRadius = 0; dataset.pointHoverRadius = 6;
}

const percentTooltip = { label: function(context) { return context.dataset.label + ': ' + (context.raw * 100).toFixed(2) + '%'; } };

// ==========================================
// 4. CHART LOADERS (COMPOSITE & COMPONENT)
// ==========================================
function loadComposite() {
    const years = getCheckedValues('year-check'); const months = getCheckedValues('month-check'); const indexes = getCheckedValues('index-check');
    fetch(`/api/composite?years=${years}&months=${months}&indexes=${indexes}`).then(res => res.json()).then(data => {
        if (data.error) return alert(data.error);
        destroyChart('cIndex'); destroyChart('cYoY'); destroyChart('cMoM');
        const calcWidth = Math.max(document.querySelector('.scroll-container').clientWidth, data.labels.length * 40) + 'px';
        document.getElementById('wrapperIndex').style.width = calcWidth; document.getElementById('wrapperYoY').style.width = calcWidth; document.getElementById('wrapperMoM').style.width = calcWidth;

        data.idx.forEach(d => { d.backgroundColor = compTheme[d.label]; d.borderRadius = 2; });
        data.yoy.forEach(d => setupLineDataset(d, compTheme[d.label]));
        data.mom.forEach(d => setupLineDataset(d, compTheme[d.label]));

        let optIndex = getCommonOptions('Composite Index');
        charts['cIndex'] = new Chart(document.getElementById('cIndexChart'), { type: 'bar', data: { labels: data.labels, datasets: data.idx }, options: optIndex });
        let optYoY = getCommonOptions('Percentage'); optYoY.scales.y.ticks.callback = v => (v * 100).toFixed(0) + '%'; optYoY.plugins.tooltip.callbacks = percentTooltip;
        charts['cYoY'] = new Chart(document.getElementById('cYoYChart'), { type: 'line', data: { labels: data.labels, datasets: data.yoy }, options: optYoY });
        let optMoM = JSON.parse(JSON.stringify(optYoY)); optMoM.plugins.tooltip.callbacks = percentTooltip;
        charts['cMoM'] = new Chart(document.getElementById('cMoMChart'), { type: 'line', data: { labels: data.labels, datasets: data.mom }, options: optMoM });
    });
}

function loadComponent() {
    const years = getCheckedValues('cmp-year-check'); 
    const months = getCheckedValues('cmp-month-check'); 
    const indexes = getCheckedValues('cmp-index-check'); 
    const comps = getCheckedValues('cmp-comp-check');
    
    fetch(`/api/component?years=${encodeURIComponent(years)}&months=${encodeURIComponent(months)}&indexes=${encodeURIComponent(indexes)}&components=${encodeURIComponent(comps)}`)
    .then(res => res.json())
    .then(data => {
        if (data.error) return alert(data.error);
        
        destroyChart('cmpIndex'); 
        destroyChart('cmpMoM');
        
        const calcWidth = Math.max(document.querySelector('.scroll-container').clientWidth, data.labels.length * 40) + 'px';
        if (document.getElementById('wrapperCmpIndex')) document.getElementById('wrapperCmpIndex').style.width = calcWidth; 
        if (document.getElementById('wrapperCmpMoM')) document.getElementById('wrapperCmpMoM').style.width = calcWidth;

        data.idx.forEach((d, i) => { d.backgroundColor = cafePalette[i % cafePalette.length]; d.borderRadius = 2; });
        data.mom.forEach((d, i) => setupLineDataset(d, cafePalette[i % cafePalette.length]));

        let optIndex = getCommonOptions('Component');
        optIndex.plugins.tooltip.titleFont = { size: 12 };
        optIndex.plugins.tooltip.bodyFont = { size: 10 };
        optIndex.plugins.tooltip.padding = 8;
        optIndex.plugins.tooltip.itemSort = (a, b) => b.raw - a.raw;
        // Pastikan tooltip bar chart pun sentiasa di sebelah (center secara menegak)
        optIndex.plugins.tooltip.yAlign = 'center'; 

        charts['cmpIndex'] = new Chart(document.getElementById('cmpIndexChart'), { 
            type: 'bar', 
            data: { labels: data.labels, datasets: data.idx }, 
            options: optIndex 
        });

        let optMoM = getCommonOptions('Percentage'); 
        optMoM.scales.y.ticks.callback = v => (v * 100).toFixed(0) + '%'; 
        optMoM.plugins.tooltip.callbacks = percentTooltip;
        
        optMoM.plugins.tooltip.titleFont = { size: 12 };
        optMoM.plugins.tooltip.bodyFont = { size: 10 };
        optMoM.plugins.tooltip.padding = 8;
        optMoM.plugins.tooltip.itemSort = (a, b) => b.raw - a.raw;
        
        // --- FIX UTAMA DI SINI ---
        // yAlign 'center' memaksa anak panah (caret) berada di SISI kotak (kiri/kanan),
        // dan secara automatik kotak akan beralih ke sebelah cursor, tidak lagi di atas/bawah.
        optMoM.plugins.tooltip.yAlign = 'center';
        
        // Pastikan ia kekal membaca semua komponen untuk bulan tersebut
        optMoM.interaction = { mode: 'index', intersect: false }; 

        charts['cmpMoM'] = new Chart(document.getElementById('cmpMoMChart'), { 
            type: 'line', 
            data: { labels: data.labels, datasets: data.mom }, 
            options: optMoM 
        });
    });
}

// ==========================================
// 5. MBCC ENGINE (ANIMATION, ZOOM, MANUAL SCALE)
// ==========================================
const quadrantPlugin = {
    id: 'quadrants',
    beforeDraw(chart) {
        const {ctx, chartArea: {left, top, right, bottom}, scales: {x, y}} = chart;
        const midX = x.getPixelForValue(0); 
        const midY = y.getPixelForValue(0);
        
        ctx.save();
        ctx.fillStyle = 'rgba(238, 175, 132, 0.4)'; ctx.fillRect(left, top, midX - left, midY - top); // Slowdown
        ctx.fillStyle = 'rgba(164, 234, 185, 0.4)'; ctx.fillRect(midX, top, right - midX, midY - top); // Expansion
        ctx.fillStyle = 'rgba(251, 238, 124, 0.4)'; ctx.fillRect(midX, midY, right - midX, bottom - midY); // Recovery
        ctx.fillStyle = 'rgba(224, 150, 150, 0.4)'; ctx.fillRect(left, midY, midX - left, bottom - midY); // Recession
        ctx.restore();
    }
};

function applyManualScale() {
    let chart = charts['mbcc'];
    if(!chart) return;
    
    let xMin = document.getElementById('scale-x-min').value;
    let xMax = document.getElementById('scale-x-max').value;
    let yMin = document.getElementById('scale-y-min').value;
    let yMax = document.getElementById('scale-y-max').value;

    if (xMin !== '') chart.options.scales.x.min = parseFloat(xMin); else delete chart.options.scales.x.min;
    if (xMax !== '') chart.options.scales.x.max = parseFloat(xMax); else delete chart.options.scales.x.max;
    if (yMin !== '') chart.options.scales.y.min = parseFloat(yMin); else delete chart.options.scales.y.min;
    if (yMax !== '') chart.options.scales.y.max = parseFloat(yMax); else delete chart.options.scales.y.max;

    chart.update();
}

function loadMBCC() {
    const years = getCheckedValues('mbcc-year-check');
    const months = getCheckedValues('mbcc-month-check'); 
    const indexes = getCheckedValues('mbcc-index-check');
    const comps = getCheckedValues('mbcc-comp-check'); 
    
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#EAEAEA' : '#4A3B32';
    const gridColorZero = isDark ? '#FFFFFF' : '#4A3B32';
    const gridColorNormal = isDark ? '#333333' : '#EAE6DF';

    fetch(`/api/mbcc?years=${years}&months=${months}&indexes=${indexes}&components=${comps}`)
    .then(res => res.json())
    .then(data => {
        if (data.error) return alert(data.error);
        destroyChart('mbcc');
        clearInterval(mbccInterval); 

        let emptyDatasets = data.datasets.map((d, i) => ({
            label: d.label, data: [], backgroundColor: [], borderColor: [], pointRadius: [], showLine: false, fill: false, pointHoverRadius: 12
        }));

        let mbccOpt = {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 1000 },
            animations: {
                x: { duration: 0 }, 
                y: { duration: 0 }, 
                radius: { from: 0, duration: 800, easing: 'easeOutBack' }
            },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, color: textColor } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: (${ctx.raw.x.toFixed(2)}, ${ctx.raw.y.toFixed(2)}) - ${ctx.raw.month}` } },
                zoom: { zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } }
            },
            scales: {
                x: { title: { display: true, text: 'X Axis (Value)', color: textColor }, ticks:{color: textColor}, grid: { color: (c) => c.tick.value === 0 ? gridColorZero : gridColorNormal, lineWidth: (c) => c.tick.value === 0 ? 2 : 1 } },
                y: { title: { display: true, text: 'Y Axis (Value)', color: textColor }, ticks:{color: textColor}, grid: { color: (c) => c.tick.value === 0 ? gridColorZero : gridColorNormal, lineWidth: (c) => c.tick.value === 0 ? 2 : 1 } }
            }
        };

        charts['mbcc'] = new Chart(document.getElementById('mbccChart'), { type: 'scatter', data: { datasets: emptyDatasets }, options: mbccOpt, plugins: [quadrantPlugin] });

        applyManualScale();

        let maxPoints = Math.max(...data.datasets.map(d => d.data.length));
        let currentIndex = 0;

        mbccInterval = setInterval(() => {
            if(currentIndex >= maxPoints) { clearInterval(mbccInterval); return; }
            data.datasets.forEach((originalData, i) => {
                if(originalData.data[currentIndex]) {
                    let point = originalData.data[currentIndex];
                    let isLatest = (currentIndex === originalData.data.length - 1);
                    let baseColor = cafePalette[i % cafePalette.length];
                    let highlightColor = '#E63946'; 
                    
                    charts['mbcc'].data.datasets[i].data.push(point);
                    charts['mbcc'].data.datasets[i].backgroundColor.push(isLatest ? highlightColor : baseColor);
                    charts['mbcc'].data.datasets[i].borderColor.push(isLatest ? '#8B0000' : baseColor);
                    charts['mbcc'].data.datasets[i].pointRadius.push(isLatest ? 10 : 5.5); 
                }
            });
            charts['mbcc'].update(); 
            currentIndex++;
        }, 800);
    });
}

function updateComponentFilter() {
    let checkedIndexes = getCheckedValues('mbcc-index-check').split('|');
    let compItems = document.querySelectorAll('.comp-item');
    compItems.forEach(item => {
        let itemIndex = item.getAttribute('data-index');
        let checkbox = item.querySelector('input');
        if (checkedIndexes.includes('All') || checkedIndexes.includes(itemIndex)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none'; 
            checkbox.checked = false; 
        }
    });
}

// ==========================================
// 6. COMPONENT FILTER LOGIC (NEW)
// ==========================================
function updateCmpComponentFilter() {
    let checkedIndexes = getCheckedValues('cmp-index-check').split('|');
    let compItems = document.querySelectorAll('.comp-item-cmp');
    
    compItems.forEach(item => {
        let itemIndex = item.getAttribute('data-index');
        let checkbox = item.querySelector('input');
        
        if (checkedIndexes.includes('All') || checkedIndexes.includes(itemIndex)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none'; 
            checkbox.checked = false; 
        }
    });
}