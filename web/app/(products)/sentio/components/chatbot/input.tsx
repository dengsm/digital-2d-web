'use client'

import { useState, useRef, useEffect, memo } from 'react';
import { StopCircleIcon, MicrophoneIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { useSentioAsrStore, useChatRecordStore, useSentioAgentStore, useSentioTtsStore, useSentioBasicStore } from '@/lib/store/sentio';
import { Input, Button, Spinner, addToast, Tooltip, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { CHAT_ROLE } from '@/lib/protocol';
import { api_asr_infer_file, api_agent_stream, api_tts_infer } from '@/lib/api/server';
import { Live2dManager } from '@/lib/live2d/live2dManager';
import { SENTIO_TTS_PUNC, SENTIO_TTS_SENTENCE_LENGTH_MIN } from '@/lib/constants';
import { base64ToArrayBuffer, ttsTextPreprocess } from '@/lib/func';
import { convertMp3ArrayBufferToWavArrayBuffer } from '@/lib/utils/audio';
import { createASRWebsocketClient, WS_RECV_ACTION_TYPE, WS_SEND_ACTION_TYPE } from '@/lib/api/websocket';
import { useTranslations } from 'next-intl';
import { convertToMp3, convertFloat32ArrayToMp3, AudioRecoder } from '@/lib/utils/audio';
import Recorder from 'js-audio-recorder';
import { useMicVAD } from "@ricky0123/vad-react"
import { useChatWithAgent, useAudioTimer } from '../../hooks/chat';
import { getSrcPath } from '@/lib/path';
import clsx from 'clsx';
import html2canvas from 'html2canvas';

let micRecoder: Recorder | null = null;


export const ChatInput = memo(({ 
    postProcess
}: {
    postProcess?: (conversation_id: string, message_id: string, think: string, content: string) => void
   
}) => {
    const t = useTranslations('Products.sentio');
    const [message, setMessage] = useState("");
    const [startMicRecord, setStartMicRecord] = useState(false);
    const [startAsrConvert, setStartAsrConvert] = useState(false);
    const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
    const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);
    const { enable: enableASR, engine: asrEngine, settings: asrSettings } = useSentioAsrStore();
    const { addChatRecord, updateLastRecord } = useChatRecordStore();
    const { engine: agentEngine, settings: agentSettings } = useSentioAgentStore();
    const { engine: ttsEngine, settings: ttsSettings } = useSentioTtsStore();
    const { sound } = useSentioBasicStore();
    const { chat, abort, chatting } = useChatWithAgent();
    const { startAudioTimer, stopAudioTimer } = useAudioTimer();
    const conversationIdRef = useRef<string>("");
    const handleStartRecord = () => {
        abort();
        if (micRecoder == null) {
            micRecoder = new Recorder({
                sampleBits: 16,         // 采样位数，支持 8 或 16，默认是16
                sampleRate: 16000,      // 采样率，支持 11025、16000、22050、24000、44100、48000
                numChannels: 1,         // 声道，支持 1 或 2， 默认是1
                compiling: false,
            })
        }
        micRecoder.start().then(
            () => {
                startAudioTimer();
                setStartMicRecord(true);
            }, () => {
                addToast({
                    title: t('micOpenError'),
                    variant: "flat",
                    color: "danger"
                })
            }
        )
    }
//原有录音逻辑
    // const handleStopRecord = async () => {
    //     micRecoder.stop();
    //     setStartMicRecord(false);
    //     if (!stopAudioTimer()) return;
    //     // 开始做语音识别
    //     setMessage(t('speech2text'));
    //     setStartAsrConvert(true);
    //     // 获取mp3数据, 转mp3的计算放到web客户端, 后端拿到的是mp3数据
    //     const mp3Blob = convertToMp3(micRecoder);
    //     let asrResult = "";
    //     asrResult = await api_asr_infer_file(asrEngine, asrSettings, mp3Blob);
    //     if (asrResult.length > 0) {
    //         setMessage(asrResult);
    //     } else {
    //         setMessage("");
    //     }
    //     setStartAsrConvert(false);
    // }
    const handleStopRecord = async () => {
        try {
            // 停止录音
            micRecoder.stop();
            setStartMicRecord(false);
            
            if (!stopAudioTimer()) return;
            
            // 开始做语音识别
            setMessage(t('speech2text'));
            setStartAsrConvert(true);
            
            try {
                // 获取mp3数据
                const mp3Blob = convertToMp3(micRecoder);
                
                // 释放麦克风资源
                micRecoder.destroy();
                micRecoder = null;
                
                // 进行语音识别
                const asrResult = await api_asr_infer_file(asrEngine, asrSettings, mp3Blob);
                
                if (asrResult.length > 0) {
                    setMessage(asrResult);
                } else {
                    setMessage("");
                }
            } catch (error) {
                console.error("Error during speech recognition:", error);
                setMessage("");
            } finally {
                setStartAsrConvert(false);
            }
        } catch (error) {
            console.error("Error stopping recording:", error);
            setStartMicRecord(false);
            setStartAsrConvert(false);
        }
    }


    const onFileClick = () => {
        // TODO: open file dialog
    }
    const onSendClick = async () => {
        if (message == "") return;
        
        // 保存当前消息内容
        const currentMessage = message;
        
        // 立即清空输入框
        setMessage("");
        // console.log('立即显示用户消息:', currentMessage);
        
        // 立即在UI上显示用户消息和AI等待状态
        addChatRecord({ role: CHAT_ROLE.HUMAN, think: "", content: currentMessage });
        addChatRecord({ role: CHAT_ROLE.AI, think: "", content: "..." });
        
        // 异步获取截图并发送完整消息（不再重复添加UI消息）
        sendMessageWithScreenshot(currentMessage);
    }
    
    // 异步获取截图并发送完整消息
    const sendMessageWithScreenshot = async (messageContent: string) => {
        let screenshotDataUrl: string | null = null;
        try {
            // 等待一秒确保页面渲染完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // console.log('开始异步截取整个网页内容...');
            screenshotDataUrl = await captureFullPageScreenshot();
            
            // 全页面截图函数（重构版本 - 针对index.html父页面截图）
            async function captureFullPageScreenshot(): Promise<string> {
                // console.log('=== 开始全页面截图（针对index.html父页面） ===');
                
                // 检查是否在iframe中
                const isInIframe = window !== window.top;
                // console.log('是否在iframe中:', isInIframe);
                
                if (isInIframe) {
                    // 在iframe中，需要通过postMessage请求父页面截图
                    // console.log('检测到iframe环境，将请求父页面执行截图');
                    
                    return new Promise((resolve, reject) => {
                        // 设置超时处理
                        const timeout = setTimeout(() => {
                            // console.error('父页面截图请求超时');
                            reject(new Error('父页面截图请求超时'));
                        }, 30000); // 30秒超时
                        
                        // 监听父页面的回复
                        const messageHandler = (event: MessageEvent) => {
                            // console.log('收到父页面消息:', event.data);
                            
                            if (event.data.type === 'SCREENSHOT_RESPONSE') {
                                clearTimeout(timeout);
                                window.removeEventListener('message', messageHandler);
                                
                                if (event.data.success) {
                                    // console.log('父页面截图成功，数据大小:', Math.round(event.data.imageData.length / 1024), 'KB');
                                    resolve(event.data.imageData);
                                } else {
                                    // console.error('父页面截图失败:', event.data.error);
                                    reject(new Error(event.data.error || '父页面截图失败'));
                                }
                            }
                        };
                        
                        window.addEventListener('message', messageHandler);
                        
                        // 发送截图请求给父页面
                        const request = {
                            type: 'SCREENSHOT_REQUEST',
                            timestamp: Date.now(),
                            source: 'digital-human-iframe'
                        };
                        
                        // console.log('发送截图请求给父页面:', request);
                        window.parent.postMessage(request, '*');
                    });
                } else {
                    // 不在iframe中，直接截取当前页面
                    // console.log('不在iframe中，直接截取当前页面');
                    return await captureCurrentPageDirectly();
                }
            }
            
            // 直接截取当前页面的函数
            async function captureCurrentPageDirectly(): Promise<string> {
                // console.log('开始直接截取当前页面');
                
                const targetElement = document.documentElement || document.body;
                
                // 计算完整的尺寸
                const fullWidth = Math.max(
                    document.documentElement.scrollWidth,
                    document.documentElement.offsetWidth,
                    document.documentElement.clientWidth,
                    window.innerWidth
                );
                
                const fullHeight = Math.max(
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight,
                    document.documentElement.clientHeight,
                    window.innerHeight
                );
                
                // console.log('页面尺寸:', fullWidth, 'x', fullHeight);
                
                const canvasOptions: any = {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    scale: 1,
                    logging: true,
                    width: fullWidth,
                    height: fullHeight,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: window.innerWidth,
                    windowHeight: window.innerHeight,
                    x: 0,
                    y: 0,
                    foreignObjectRendering: true,
                    removeContainer: false,
                    imageTimeout: 15000
                };
                
                try {
                    const canvas = await html2canvas(targetElement, canvasOptions);
                    // console.log('直接截图成功，尺寸:', canvas.width, 'x', canvas.height);
                    return canvas.toDataURL('image/png', 1.0);
                } catch (error) {
                    // console.error('直接截图失败:', error);
                    throw error;
                }
            }
            
            // 截图完成，一次性发送带image字段的完整消息
            // console.log('截图完成，准备发送带截图的完整消息');
            
        } catch (error) {
            // console.error('异步截图失败:', error);
            // console.log('截图失败，将发送不带截图的消息');
        }
        
        // 无论截图成功与否，都发送消息给后端（带或不带截图）
        if (screenshotDataUrl) {
            // console.log('发送带截图的完整消息给后端，截图大小:', Math.round(screenshotDataUrl.length / 1024), 'KB');
        } else {
            // console.log('发送不带截图的消息给后端');
        }
        
        // 发送消息+截图数据给后端（注意：UI已经在onSendClick中显示了）
        sendMessageToBackend(messageContent, screenshotDataUrl);
    }
    
    // 发送消息和截图数据到后端（不重复添加UI消息）
    const sendMessageToBackend = (messageContent: string, screenshotData: string | null) => {
        // console.log('🚀 发送消息到后端，包含截图数据，避免重复UI显示');
        // console.log('📝 消息内容:', messageContent);
        // console.log('📷 截图数据:', screenshotData ? `存在，长度: ${screenshotData.length}` : '无');
        // console.log('🤖 Agent引擎:', agentEngine);
        // console.log('⚙️ Agent设置:', agentSettings);
        // console.log('💬 会话ID:', conversationIdRef.current);
        
        // 创建AbortController用于取消请求
        const controller = new AbortController();
        
        // 累积AI回复内容和思考内容
        let accumulatedResponse = "";
        let accumulatedThink = "";
        
        // TTS相关状态
        let ttsProcessIndex = 0;
        let agentDone = true;
        
        // 根据断句符号找到第一个断句
        const findPuncIndex = (content: string, beginIndex: number) => {
            let latestIndex = -1;
            // 找最近的断句标点符号
            for (let i = 0; i < SENTIO_TTS_PUNC.length; i++) {
                const index = content.indexOf(SENTIO_TTS_PUNC[i], beginIndex);
                if (index > beginIndex) {
                    if (latestIndex < 0 || index < latestIndex) {
                        latestIndex = index;
                    }
                }
            }
            return latestIndex;
        };
        
        // TTS处理函数
        const doTTS = () => {
           // console.log('🔊 doTTS 被调用, agentDone:', agentDone, 'ttsProcessIndex:', ttsProcessIndex, 'accumulatedResponseLength:', accumulatedResponse.length);
            if (!!!controller) {
                console.error('❌ TTS 控制器未初始化');
                return;
            }
            // agent持续输出中 | agentResponse未处理完毕
            if (!agentDone || accumulatedResponse.length > ttsProcessIndex) {
                let ttsText = "";
                const ttsCallback = (ttsResult: string) => {
                    //console.log('🔊 ttsCallback 被调用, 结果长度:', ttsResult?.length || 0);
                    if (ttsResult != "") {
                        try {
                            //console.log('🔊 开始处理TTS结果, 原始数据长度:', ttsResult.length);
                            const audioData = base64ToArrayBuffer(ttsResult);
                            //console.log('🔊 转换后的音频数据大小:', audioData?.byteLength || 0);
                            
                            convertMp3ArrayBufferToWavArrayBuffer(audioData)
                                .then((buffer) => {
                                    //console.log('✅ 音频转换成功, 缓冲区大小:', buffer?.byteLength || 0);
                                    try {
                                        const manager = Live2dManager.getInstance();
                                        console.log('🔊 Live2D Manager 实例:', manager ? '已初始化' : '未初始化');
                                        if (manager) {
                                            manager.pushAudioQueue(buffer);
                                          //  console.log('✅ 音频已推送到播放队列');
                                        } else {
                                            console.error('❌ Live2D Manager 未正确初始化');
                                        }
                                    } catch (e) {
                                        console.error('❌ 推送音频到队列时出错:', e);
                                    }
                                })
                                .catch(error => {
                                    console.error('❌ 音频转换失败:', error);
                                });
                        } catch (e) {
                            console.error('❌ 处理TTS结果时出错:', e);
                        }
                    } else {
                        console.log('ℹ️ 空的TTS结果，跳过处理');
                    }
                    // TTS处理完毕，继续处理下一个断句
                    doTTS();
                };

                let beginIndex = ttsProcessIndex;
                while (beginIndex >= ttsProcessIndex) {
                    const puncIndex = findPuncIndex(accumulatedResponse, beginIndex);
                    // 找到断句
                    if (puncIndex > beginIndex) {
                        if (puncIndex - ttsProcessIndex > SENTIO_TTS_SENTENCE_LENGTH_MIN) {
                            ttsText = accumulatedResponse.substring(ttsProcessIndex, puncIndex + 1);
                            ttsProcessIndex = puncIndex + 1;
                            break;
                        } else {
                            // 长度不符合, 继续往后找
                            beginIndex = puncIndex + 1;
                            continue;
                        }
                    }
                    // 未找到
                    beginIndex = -1;
                }
                if (ttsText.length == 0 && agentDone) {
                    // agent输出完毕，但未找到断句符号，则将剩余内容全部进行TTS
                    ttsText = accumulatedResponse.substring(ttsProcessIndex);
                    ttsProcessIndex = accumulatedResponse.length;
                }
                if (ttsText != "") {
                    // 处理断句tts
                    const processText = ttsTextPreprocess(ttsText);
                    if (!!processText) {
                        api_tts_infer(
                            ttsEngine, 
                            ttsSettings, 
                            processText, 
                            controller.signal
                        ).then((ttsResult) => {ttsCallback(ttsResult)});
                    } else {
                        ttsCallback("");
                    }
                } else {
                    // 10ms 休眠定时器执行
                    setTimeout(() => {
                        doTTS();
                    }, 10);
                }
            }
        };
        
        // 定义回调函数处理AI响应 - 优化版本，去除预期之外的内容并添加TTS支持
        const agentCallback = (response: any) => {
           // console.log('✅ 收到AI响应:', response);
          //  console.log('📊 响应事件类型:', response.event);
           // console.log('📄 响应数据:', response.data);
            
            const event = response.event;
            const data = response.data;
            
            // 只处理有效的数据内容，过滤空值和无意义内容
            const isValidData = data && typeof data === 'string' && data.trim() !== '';
            
            // 根据不同的事件类型处理
            switch (event) {
                case 'conversation_id':
                case 'CONVERSATION_ID':
                    // console.log('🆔 会话ID:', data);
                    conversationIdRef.current = data;
                    break;
                    
                case 'message_id':
                case 'MESSAGE_ID':
                    // console.log('📧 消息ID:', data);
                    break;
                    
                case 'agent_thinking':
                case 'think':
                case 'THINK':
                    if (isValidData) {
                        // console.log('🤔 AI思考中:', data);
                        accumulatedThink += data;
                        // 只有在有实际回复内容时才显示，避免显示占位符
                        const displayContent = accumulatedResponse || (accumulatedThink ? "思考中..." : "");
                        updateLastRecord({ role: CHAT_ROLE.AI, think: accumulatedThink, content: displayContent });
                    }
                    break;
                    
                case 'agent_response':
                case 'text':
                case 'TEXT':
                    if (isValidData) {
                       // console.log('💬 收到AI回复内容片段:', data);
                        accumulatedResponse += data;
                        updateLastRecord({ role: CHAT_ROLE.AI, think: accumulatedThink, content: accumulatedResponse });
                        
                        // 触发TTS语音播报
                        if (agentDone && sound) {
                           // console.log('🔊 触发TTS语音播报，sound状态:', sound, 'agentDone:', agentDone);
                            agentDone = false;
                            doTTS();
                        } else {
                            console.log('🔇 未触发TTS，原因:', { sound, agentDone });
                        }
                    }
                    break;
                    
                case 'task':
                case 'TASK':
                case 'done':
                case 'DONE':
                    // console.log('✅ AI回复完成，最终内容:', accumulatedResponse);
                    // 确保最终内容被正确显示，清除思考内容
                    if (accumulatedResponse && accumulatedResponse.trim() !== '') {
                        // console.log('🎆 最终内容:', accumulatedResponse);
                        updateLastRecord({ role: CHAT_ROLE.AI, think: "", content: accumulatedResponse.trim() });
                    } else {
                        // 如果没有有效回复内容，显示默认消息
                        updateLastRecord({ role: CHAT_ROLE.AI, think: "", content: '抱歉，没有收到有效回复。' });
                    }
                    
                    // 处理TTS结束逻辑
                    if (postProcess) {
                        postProcess(conversationIdRef.current, "", accumulatedThink, accumulatedResponse);
                    }
                    // 标记agent输出结束，让TTS处理剩余内容
                    agentDone = true;
                    break;
                    
                case 'error':
                case 'ERROR':
                    // console.error('❌ AI响应错误:', data);
                    updateLastRecord({ role: CHAT_ROLE.AI, think: "", content: '抱歉，AI响应出现错误，请重试。' });
                    break;
                    
                default:
                    // 对于未知事件类型，只记录日志，不处理内容，避免添加预期之外的内容
                    // console.log('❓ 未知事件类型，已忽略:', event, '数据:', data);
                    break;
            }
        };
        
        // 定义错误回调函数处理AI响应错误
        const agentErrorCallback = (error: Error) => {
            // console.error('❌ Agent API错误:', error);
            // console.error('🔍 错误详情:', error.message);
            // console.error('📋 错误堆栈:', error.stack);
            updateLastRecord({ role: CHAT_ROLE.AI, think: "", content: '抱歉，发生了错误，请重试。' });
        };
        
        // console.log('🔄 开始调用API...');
        // 直接调用API，不通过chat函数（避免重复添加UI消息）
        try {
            api_agent_stream(
                agentEngine,
                agentSettings,
                messageContent,
                conversationIdRef.current,
                controller.signal,
                agentCallback,
                agentErrorCallback,
                screenshotData
            );
            // console.log('✨ API调用已发起');
        } catch (error) {
            // console.error('💥 API调用失败:', error);
            updateLastRecord({ role: CHAT_ROLE.AI, think: "", content: '抱歉，API调用失败，请重试。' });
        }
    };
    
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // 检查是否是 Enter 键，并且不在输入法组合输入过程中
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            onSendClick();
        }
    }
    
    // 生成占位图片函数
    const generatePlaceholderImage = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 300;
        
        // 绘制黑色背景
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制白色文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Live2D 数字人截图', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('(技术限制，显示占位图)', canvas.width / 2, canvas.height / 2 + 20);
        
        return canvas.toDataURL('image/png');
    };
    
    // 快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "m" && e.ctrlKey) {
                if (startMicRecord) {
                    handleStopRecord();
                } else {
                    handleStartRecord();
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        }
    })

    return (
        <div className='flex flex-col w-4/5 md:w-2/3 2xl:w-1/2 items-start z-10 gap-2'>
            <div className='flex w-full items-center z-10'>
                <Input
                    className='opacity-90'
                    startContent={
                        <button
                            type="button"
                            disabled={!enableASR}
                            aria-label="toggle password visibility"
                            className={clsx(
                                "focus:outline-none",
                                startMicRecord ? "text-red-500" : enableASR ? "hover:text-green-500" : "hover:text-gray-500"
                            )}
                        >
                            {startMicRecord ? (
                                <StopCircleIcon className='size-6' onClick={handleStopRecord} />
                            ) : (
                                startAsrConvert ? (
                                    <Spinner size="sm" />
                                ) : (
                                    <Tooltip className='opacity-90' content="Ctrl + M">
                                        <MicrophoneIcon className='size-6' onClick={handleStartRecord} />
                                    </Tooltip>
                                )
                            )}
                        </button>
                    }
                    endContent={
                        chatting ?
                            <button
                                type="button"
                                onClick={abort}
                                className="focus:outline-none hover:text-red-500"
                            >
                                <StopCircleIcon className='size-6' />
                            </button>
                            :
                            <></>
                        // <button
                        //     type="button"
                        //     onClick={onFileClick}
                        //     className="focus:outline-none hover:text-blue-500"
                        // >
                        //     <PaperClipIcon className='size-6 pointer-events-none' />
                        // </button>
                    }
                    type='text'
                    enterKeyHint='send'
                    value={message}
                    onValueChange={setMessage}
                    onKeyDown={onKeyDown}
                    disabled={startMicRecord || startAsrConvert}
                />
                <Button className='opacity-90' isIconOnly color="primary" onPress={onSendClick}>
                    <PaperAirplaneIcon className='size-6' />
                </Button>
            </div>
            
            {/* 截图预览模态框 */}
            <Modal 
                isOpen={showScreenshotPreview} 
                onClose={() => setShowScreenshotPreview(false)}
                size="2xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        截图预览
                    </ModalHeader>
                    <ModalBody className="pb-6">
                        {screenshotDataUrl && (
                            <div className="bg-black rounded p-2">
                                <img 
                                    src={screenshotDataUrl} 
                                    alt="Live2D截图" 
                                    className="w-full h-auto rounded"
                                    style={{ backgroundColor: '#000000' }}
                                />
                            </div>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    )
});

const convertFloat32ToAnalyseData = (float32Data: Float32Array) => {
    const analyseData = new Uint8Array(float32Data.length);
    const dataLength = float32Data.length;

    for (let i = 0; i < dataLength; i++) {
        const value = float32Data[i];
        // 将 -1 到 1 的值映射到 0 到 255
        const mappedValue = Math.round((value + 1) * 128);
        // 确保值在 0 到 255 之间
        analyseData[i] = Math.max(0, Math.min(255, mappedValue));
    }

    return analyseData;
}

export const ChatVadInput = memo(() => {
    const t = useTranslations('Products.sentio');
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const { engine: asrEngine, settings: asrSettings } = useSentioAsrStore();
    const { chat, abort } = useChatWithAgent();
    const { startAudioTimer, stopAudioTimer } = useAudioTimer();
    const waveData = useRef<Uint8Array | null>();
    const drawId = useRef<number | null>(null);

    const handleSpeechEnd = async (audio: Float32Array) => {
        // 获取mp3数据, 转mp3的计算放到web客户端, 后端拿到的是mp3数据
        const mp3Blob = convertFloat32ArrayToMp3(audio);
        let asrResult = ""
        asrResult = await api_asr_infer_file(asrEngine, asrSettings, mp3Blob);
        if (asrResult.length > 0) {
            // ASR结果直接调用chat，不跳过UI更新（这是正常的语音输入流程）
            chat(asrResult);
        }
    }
    const vad = useMicVAD({
        baseAssetPath: getSrcPath("vad/"),
        onnxWASMBasePath: getSrcPath("vad/"),
        // model: "v5",
        onSpeechStart: () => {
            abort();
            startAudioTimer();
        },
        onFrameProcessed: (audio, frame) => {
            // frame 转 dataUnit8Array
            const dataUnit8Array = convertFloat32ToAnalyseData(frame);
            waveData.current = dataUnit8Array;
        },
        onSpeechEnd: (audio) => {
            if (stopAudioTimer()) {
                handleSpeechEnd(audio);
            }
        },
    });

    const initCanvas = () => {
        const dpr = window.devicePixelRatio || 1
        const canvas = document.getElementById('voice-input') as HTMLCanvasElement

        if (canvas) {
            const { width: cssWidth, height: cssHeight } = canvas.getBoundingClientRect()

            canvas.width = dpr * cssWidth
            canvas.height = dpr * cssHeight
            canvasRef.current = canvas

            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.scale(dpr, dpr)
                ctx.fillStyle = 'rgb(215, 183, 237)'
                ctxRef.current = ctx
            }
        }
    }

    function drawCanvas() {
        const canvas = canvasRef.current!
        const ctx = ctxRef.current!
        if (canvas && ctx && waveData.current) {
            const resolution = 3
            const dataArray = [].slice.call(waveData.current)
            const lineLength = parseInt(`${canvas.width / resolution}`)
            const gap = parseInt(`${dataArray.length / lineLength}`)

            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.beginPath()
            let x = 0
            for (let i = 0; i < lineLength; i++) {
                let v = dataArray.slice(i * gap, i * gap + gap).reduce((prev: number, next: number) => {
                    return prev + next
                }, 0) / gap

                // if (v < 128)
                //     v = 128
                // if (v > 178)
                //     v = 178
                const y = (v - 128) / 128 * canvas.height

                ctx.moveTo(x, 16)
                if (ctx.roundRect)
                    ctx.roundRect(x, 16 - y, 2, y, [1, 1, 0, 0])
                else
                    ctx.rect(x, 16 - y, 2, y)
                ctx.fill()
                x += resolution
            }
            ctx.closePath();
        }
        drawId.current = requestAnimationFrame(drawCanvas);
    }

    useEffect(() => {
        initCanvas();
        drawId.current = requestAnimationFrame(drawCanvas);
        return () => {
            !!drawId.current && cancelAnimationFrame(drawId.current);
        }
    }, [])

    return (
        // <div>{vad.userSpeaking ? "User is speaking" : "no speaking"}</div>
        <div className='flex flex-col h-10 w-1/2 md:w-1/3 items-center'>
            {vad.loading && <div className='flex flex-row gap-1 items-center'>
                    <p className='text-xl font-bold'>{t('loading')}</p>
                    <Spinner color='warning' variant="dots" size='lg'/>
                </div>
            }
            <canvas id="voice-input" className='h-full w-full' />
        </div>
        
    )
});

export const ChatStreamInput = memo(() => {
    const t = useTranslations('Products.sentio');
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const { chat, abort } = useChatWithAgent();
    const { engine, settings } = useSentioAsrStore();
    const { getLastRecord, updateLastRecord, addChatRecord, deleteLastRecord } = useChatRecordStore();
    const waveData = useRef<Uint8Array | null>();
    const drawId = useRef<number | null>(null);
    const [engineLoading, setEngineLoading] = useState<boolean>(true);
    const engineReady = useRef<boolean>(false);

    const initCanvas = () => {
        const dpr = window.devicePixelRatio || 1
        const canvas = document.getElementById('voice-input') as HTMLCanvasElement

        if (canvas) {
            const { width: cssWidth, height: cssHeight } = canvas.getBoundingClientRect()

            canvas.width = dpr * cssWidth
            canvas.height = dpr * cssHeight
            canvasRef.current = canvas

            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.scale(dpr, dpr)
                ctx.fillStyle = 'rgb(215, 183, 237)'
                ctxRef.current = ctx
            }
        }
    }

    function drawCanvas() {
        const canvas = canvasRef.current!
        const ctx = ctxRef.current!
        if (canvas && ctx && waveData.current) {
            const dataArray = [].slice.call(waveData.current)
            const resolution = 10
            const lineLength = parseInt(`${canvas.width / resolution}`)
            const gap = parseInt(`${dataArray.length / lineLength}`)
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.beginPath()
            let x = 0
            for (let i = 0; i < lineLength; i++) {
                let v = dataArray.slice(i * gap, i * gap + gap).reduce((prev: number, next: number) => {
                    return prev + next
                }, 0) / gap

                // if (v < 128)
                //     v = 128
                // if (v > 178)
                //     v = 178
                const y = (v - 128) / 128 * canvas.height

                ctx.moveTo(x, 16)
                if (ctx.roundRect)
                    ctx.roundRect(x, 16 - y, 2, y, [1, 1, 0, 0])
                else
                    ctx.rect(x, 16 - y, 2, y)
                ctx.fill()
                x += resolution
            }
            ctx.closePath();
        }
        drawId.current = requestAnimationFrame(drawCanvas);
    }

    useEffect(() => {
        const asrWsClient = createASRWebsocketClient({
            engine: engine,
            config: settings,
            onMessage: (action: string, data: Uint8Array) => {
                const recvAction = action as WS_RECV_ACTION_TYPE;
                const recvData = new TextDecoder('utf-8').decode(data).trim();
                switch (recvAction) {
                    case WS_RECV_ACTION_TYPE.ENGINE_INITIALZING:
                        break;
                    case WS_RECV_ACTION_TYPE.ENGINE_STARTED:
                        setEngineLoading(false);
                        engineReady.current = true;
                        break;
                    case WS_RECV_ACTION_TYPE.ENGINE_PARTIAL_OUTPUT:
                        const lastChatRecord = getLastRecord();
                        if (lastChatRecord && lastChatRecord.role == CHAT_ROLE.AI) {
                            abort();
                            addChatRecord({ role: CHAT_ROLE.HUMAN, think: "", content: recvData })
                        } else {
                            updateLastRecord({ role: CHAT_ROLE.HUMAN, think: "", content: recvData })
                        }
                        break;
                    case WS_RECV_ACTION_TYPE.ENGINE_FINAL_OUTPUT:
                        deleteLastRecord();
                        // 传入skipUIUpdate: true，避免重复显示消息（因为ASR已经在PARTIAL_OUTPUT阶段显示了用户消息）
                        // console.log('ASR语音识别完成，调用chat函数，跳过UI更新避免重复显示');
                        chat(recvData, undefined, undefined, true);
                        break;
                    case WS_RECV_ACTION_TYPE.ENGINE_STOPPED:
                        setEngineLoading(true);
                        engineReady.current = false;
                        break;
                    case WS_RECV_ACTION_TYPE.ERROR:
                        setEngineLoading(true);
                        engineReady.current = false;
                        addToast({
                            title: recvData,
                            variant: "flat",
                            color: "danger"
                        })
                        break;
                    default:
                        break;
                }
            },
            onError: (error: Error) => {
                addToast({
                    title: error.message,
                    variant: "flat",
                    color: "danger"
                })
            }
        })
        const audioRecoder = new AudioRecoder(
            16000, 
            1, 
            16000 / 1000 * 60 * 2, // 60ms数据(字节数, 一个frame 16位, 2个byte)
            (chunk: Uint8Array) => {
                try {
                    if (asrWsClient.isConnected && engineReady.current) {
                        asrWsClient.sendMessage(WS_SEND_ACTION_TYPE.ENGINE_PARTIAL_INPUT, chunk) 
                    }
                } catch(error: any) {
                    addToast({
                        title: error.message,
                        variant: "flat",
                        color: "danger"
                    })
                }
            },
            (chunk: Float32Array) => {
                if (engineReady.current) {
                    waveData.current = convertFloat32ToAnalyseData(chunk);
                }
            }
        );
        initCanvas();
        drawId.current = requestAnimationFrame(drawCanvas);
        asrWsClient.connect();
        audioRecoder.start();

        return () => {
            audioRecoder.stop();
            asrWsClient.disconnect();
            !!drawId.current && cancelAnimationFrame(drawId.current);
        }
    }, [])

    return (
        <div className='flex flex-col h-10 w-1/2 md:w-1/3 items-center'>
            {engineLoading && <div className='flex flex-row gap-1 items-center'>
                    <p className='text-xl font-bold'>{t('loading')}</p>
                    <Spinner color='warning' variant="dots" size='lg'/>
                </div>
            }
            <canvas id="voice-input" className='h-full w-full' />
        </div>
        
    )
});