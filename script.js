function gradioApp() {
    const elems = document.getElementsByTagName('gradio-app');
    const elem = elems.length == 0 ? document : elems[0];

    if (elem !== document) {
        elem.getElementById = function(id) {
            return document.getElementById(id);
        };
    }
    return elem.shadowRoot ? elem.shadowRoot : elem;
}

/**
 * Get the currently selected top-level UI tab button (e.g. the button that says "Extras").
 */
function get_uiCurrentTab() {
    return gradioApp().querySelector('#tabs > .tab-nav > button.selected');
}

/**
 * Get the first currently visible top-level UI tab content (e.g. the div hosting the "txt2img" UI).
 */
function get_uiCurrentTabContent() {
    return gradioApp().querySelector('#tabs > .tabitem[id^=tab_]:not([style*="display: none"])');
}

var uiUpdateCallbacks = [];
var uiAfterUpdateCallbacks = [];
var uiLoadedCallbacks = [];
var uiTabChangeCallbacks = [];
var optionsChangedCallbacks = [];
var optionsAvailableCallbacks = [];
var uiAfterUpdateTimeout = null;
var uiCurrentTab = null;

/**
 * Register callback to be called at each UI update.
 * The callback receives an array of MutationRecords as an argument.
 */
function onUiUpdate(callback) {
    uiUpdateCallbacks.push(callback);
}

/**
 * Register callback to be called soon after UI updates.
 * The callback receives no arguments.
 *
 * This is preferred over `onUiUpdate` if you don't need
 * access to the MutationRecords, as your function will
 * not be called quite as often.
 */
function onAfterUiUpdate(callback) {
    uiAfterUpdateCallbacks.push(callback);
}

/**
 * Register callback to be called when the UI is loaded.
 * The callback receives no arguments.
 */
function onUiLoaded(callback) {
    uiLoadedCallbacks.push(callback);
}

/**
 * Register callback to be called when the UI tab is changed.
 * The callback receives no arguments.
 */
function onUiTabChange(callback) {
    uiTabChangeCallbacks.push(callback);
}

/**
 * Register callback to be called when the options are changed.
 * The callback receives no arguments.
 * @param callback
 */
function onOptionsChanged(callback) {
    optionsChangedCallbacks.push(callback);
}

/**
 * Register callback to be called when the options (in opts global variable) are available.
 * The callback receives no arguments.
 * If you register the callback after the options are available, it's just immediately called.
 */
function onOptionsAvailable(callback) {
    if (Object.keys(opts).length != 0) {
        callback();
        return;
    }

    optionsAvailableCallbacks.push(callback);
}

function executeCallbacks(queue, arg) {
    for (const callback of queue) {
        try {
            callback(arg);
        } catch (e) {
            console.error("error running callback", callback, ":", e);
        }
    }
}

/**
 * Schedule the execution of the callbacks registered with onAfterUiUpdate.
 * The callbacks are executed after a short while, unless another call to this function
 * is made before that time. IOW, the callbacks are executed only once, even
 * when there are multiple mutations observed.
 */
function scheduleAfterUiUpdateCallbacks() {
    clearTimeout(uiAfterUpdateTimeout);
    uiAfterUpdateTimeout = setTimeout(function() {
        executeCallbacks(uiAfterUpdateCallbacks);
    }, 200);
}

var executedOnLoaded = false;

document.addEventListener("DOMContentLoaded", function() {
    var mutationObserver = new MutationObserver(function(m) {
        if (!executedOnLoaded && gradioApp().querySelector('#txt2img_prompt')) {
            executedOnLoaded = true;
            executeCallbacks(uiLoadedCallbacks);
        }

        executeCallbacks(uiUpdateCallbacks, m);
        scheduleAfterUiUpdateCallbacks();
        const newTab = get_uiCurrentTab();
        if (newTab && (newTab !== uiCurrentTab)) {
            uiCurrentTab = newTab;
            executeCallbacks(uiTabChangeCallbacks);
        }
    });
    mutationObserver.observe(gradioApp(), {childList: true, subtree: true});
});

/**
 * Add keyboard shortcuts:
 * Ctrl+Enter to start/restart a generation
 * Alt/Option+Enter to skip a generation
 * Esc to interrupt a generation
 */
document.addEventListener('keydown', function(e) {
    const isEnter = e.key === 'Enter' || e.keyCode === 13;
    const isCtrlKey = e.metaKey || e.ctrlKey;
    const isAltKey = e.altKey;
    const isEsc = e.key === 'Escape';

    const generateButton = get_uiCurrentTabContent().querySelector('button[id$=_generate]');
    const interruptButton = get_uiCurrentTabContent().querySelector('button[id$=_interrupt]');
    const skipButton = get_uiCurrentTabContent().querySelector('button[id$=_skip]');

    if (isCtrlKey && isEnter) {
        if (interruptButton.style.display === 'block') {
            interruptButton.click();
            const callback = (mutationList) => {
                for (const mutation of mutationList) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        if (interruptButton.style.display === 'none') {
                            generateButton.click();
                            observer.disconnect();
                        }
                    }
                }
            };
            const observer = new MutationObserver(callback);
            observer.observe(interruptButton, {attributes: true});
        } else {
            generateButton.click();
        }
        e.preventDefault();
    }

    if (isAltKey && isEnter) {
        skipButton.click();
        e.preventDefault();
    }

    if (isEsc) {
        const globalPopup = document.querySelector('.global-popup');
        const lightboxModal = document.querySelector('#lightboxModal');
        if (!globalPopup || globalPopup.style.display === 'none') {
            if (document.activeElement === lightboxModal) return;
            if (interruptButton.style.display === 'block') {
                interruptButton.click();
                e.preventDefault();
            }
        }
    }
});

/**
 * checks that a UI element is not in another hidden element or tab content
 */
function uiElementIsVisible(el) {
    if (el === document) {
        return true;
    }

    const computedStyle = getComputedStyle(el);
    const isVisible = computedStyle.display !== 'none';

    if (!isVisible) return false;
    return uiElementIsVisible(el.parentNode);
}

function uiElementInSight(el) {
    const clRect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const isOnScreen = clRect.bottom > 0 && clRect.top < windowHeight;

    return isOnScreen;
}


function onGenerateButtonClick() {
    console.log("生成按钮被点击。开始执行登录和生成流程...");

    // 第一步：先进行登录，获取 access_token
    const loginData = {
        grant_type: "password",
        phone_number: "13999999999",
        password: "123456"
    };

    console.log("开始登录，登录请求体:", loginData);

    fetch('http://127.0.0.1:6868/api/tokens', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
    })
    .then(response => {
        console.log("登录请求已发送，等待响应...");
        if (!response.ok) {
            console.error("登录失败，状态码:", response.status);
            throw new Error('登录失败');
        }
        return response.json();
    })
    .then(loginResponseData => {
        // 登录成功，获取 access_token
        const accessToken = loginResponseData.data.access_token;  // 从 data 中获取 access_token
        console.log("登录成功，获取到的 access_token:", accessToken);

        // 第二步：获取用户输入的生图信息
        const promptElement = document.getElementsById('prompt');
        console.log("!!!!", promptElement);
        const negativePromptElement = document.getElementById('txt2img_neg_prompt');
        const widthElement = document.getElementById('img2img_width');
        const heightElement = document.getElementById('img2img_height');
        const stepsElement = document.getElementById('txt2img_hires_steps');
        const samplerElement = document.getElementById('hr_sampler');
        const cfgScaleElement = document.getElementById('txt2img_cfg_scale');
        const seedElement = document.getElementById('img2img_seed');

        // 检查所有元素是否存在
        if (promptElement && negativePromptElement && widthElement && heightElement && stepsElement && samplerElement && cfgScaleElement && seedElement) {
            const prompt = promptElement.value;  // 获取提示信息
            console.log("!!!!", prompt);
            const negativePrompt = negativePromptElement.value;  // 获取负面提示信息
            const width = widthElement.value;    // 获取宽度
            const height = heightElement.value;  // 获取高度
            const steps = stepsElement.value;    // 获取步数
            const samplerName = samplerElement.value;  // 获取采样器
            const cfgScale = cfgScaleElement.value;  // 获取CFG scale
            const seed = seedElement.value;     // 获取种子

            // 构造请求体数据
            const userData = {
                prompt: prompt || "默认提示",
                negative_prompt: negativePrompt || "low quality, bad anatomy",
                steps: parseInt(steps, 10) || 30,
                sampler_name: samplerName || "Euler a",
                cfg_scale: parseFloat(cfgScale) || 7.0,
                width: parseInt(width, 10) || 256,
                height: parseInt(height, 10) || 256,
                seed: parseInt(seed, 10) || 12345
            };

            console.log("构造的生图请求体:", userData);

            // 发送请求的代码在这里
            fetch('http://localhost:6868/api/generate/image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,  // 使用登录获取的 access_token
                },
                body: JSON.stringify(userData),  // 发送 userData
            })
            .then(response => {
                console.log("图像生成请求已发送，等待响应...");
                if (!response.ok) {
                    console.error("图像生成请求失败，状态码:", response.status);
                    throw new Error('图像生成请求失败');
                }
                return response.json();
            })
            .then(imageResponseData => {
                console.log('图像生成成功:', imageResponseData);
            })
            .catch(error => {
                console.error('生成图像时发生错误:', error);
            });
        } else {
            console.error("某些输入元素未找到，请检查 DOM 元素是否正确存在。");
        }
        })
        .catch(error => {
            console.error('登录时发生错误:', error);
        });

    // 模拟一个带有超时的异步操作，改变按钮文本
    setTimeout(() => {
        console.log("完成执行自定义前端逻辑。");

        // 将按钮文本更改为"新生成"
        const generateButton = get_uiCurrentTabContent().querySelector('button[id$=_generate]');
        if (generateButton) {
            generateButton.textContent = "开始生图 ⚡ 19";
        }
    }, 1000); // 模拟一个在1秒后完成的异步操作
}

// 等待DOM内容完全加载
document.addEventListener("DOMContentLoaded", function() {
    setTimeout(() => {
        const currentTabContent = get_uiCurrentTabContent();
        if (currentTabContent) {
            const generateButton = currentTabContent.querySelector('button[id$=_generate]');
            if (generateButton) {
                console.log("找到生成按钮，添加点击事件监听器。");
                generateButton.addEventListener('click', onGenerateButtonClick);
            } else {
                console.log("未找到生成按钮。");
            }
        } else {
            console.log("未找到当前选项卡内容。");
        }
    }, 2000); // 延迟2秒检查
});


