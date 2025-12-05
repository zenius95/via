/* js/main.js */

let gridApi;

document.addEventListener('DOMContentLoaded', () => {
    const gridDiv = document.querySelector('#myGrid');
    
    // Đảm bảo gridOptions đã được load từ file grid.js
    if (typeof gridOptions !== 'undefined') {
        gridApi = agGrid.createGrid(gridDiv, gridOptions);
        
        // Load data sau khi giả lập delay (để thấy skeleton loading)
        setTimeout(() => gridApi.setGridOption('rowData', generateData(100)), 2000);
    } else {
        console.error("Grid Options chưa được load. Kiểm tra lại thứ tự file JS.");
    }
});