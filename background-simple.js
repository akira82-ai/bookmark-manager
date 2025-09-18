// 最简单的后台脚本测试
console.log('Background script starting...');

// 测试基本功能
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'test') {
    sendResponse({success: true, message: 'Test successful'});
  }
  
  if (request.action === 'testReminder') {
    console.log('Test reminder action received');
    sendResponse({success: true, message: 'Reminder test triggered'});
  }
});

console.log('Background script loaded successfully');