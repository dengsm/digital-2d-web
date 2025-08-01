import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware'
import { ResourceModel, ChatMessage, CHAT_MODE, APP_TYPE, IFER_TYPE, RESOURCE_TYPE, CHAT_ROLE } from '@/lib/protocol';
import * as CONSTANTS from '@/lib/constants';

// ==================== 聊天记录 ==================
interface SentioChatRecordState {
    chatRecord: ChatMessage[],
    addChatRecord: (message: ChatMessage) => void,
    getLastRecord: () => ChatMessage | undefined,
    updateLastRecord: (message: ChatMessage) => void,
    deleteLastRecord: () => void,
    clearChatRecord: () => void
}
export const useChatRecordStore = create<SentioChatRecordState>()(
    persist(
        (set) => ({
            chatRecord: [],
            addChatRecord: (message: ChatMessage) => set((state) => ({ chatRecord: [...state.chatRecord, message] })),
            getLastRecord: () => { 
                const chatRecord: ChatMessage[] = useChatRecordStore.getState().chatRecord;
                return chatRecord.length > 0 ? chatRecord[chatRecord.length - 1] : undefined; 
            },
            updateLastRecord: (message: ChatMessage) => set((state) => {
        const newRecord = [...state.chatRecord.slice(0, -1), message];
        // 防止重复的AI回复
        if (newRecord.length >= 2) {
            const lastTwo = newRecord.slice(-2);
            if (lastTwo[0].role === CHAT_ROLE.AI && lastTwo[1].role === CHAT_ROLE.AI && 
                lastTwo[0].content === lastTwo[1].content && lastTwo[0].content !== "...") {
                // 发现重复的AI回复，只保留最新的一条
                return { chatRecord: [...newRecord.slice(0, -2), message] };
            }
        }
        return { chatRecord: newRecord };
    }),
            deleteLastRecord: () => set((state) => ({ chatRecord: [...state.chatRecord.slice(0, -1)] })),
            clearChatRecord: () => set((state) => ({ chatRecord: [] })),
        }),
        {
            name: 'sentio-chat-record-storage'
        }
    )
)

// ==================== 基础设置 ==================
interface SentioBasicState {
    sound: boolean,
    lipFactor: number,
    showThink: boolean
    setSound: (sound: boolean) => void
    setShowThink: (showThink: boolean) => void
    setLipFactor: (weight: number) => void
}

export const useSentioBasicStore = create<SentioBasicState>()(
    persist(
        (set) => ({
            sound: true,
            showThink: true,
            lipFactor: CONSTANTS.SENTIO_LIPFACTOR_DEFAULT,
            setSound: (sound: boolean) => set((state) => ({ sound: sound })),
            setShowThink: (showThink: boolean) => set((state) => ({ showThink: showThink })),
            setLipFactor: (weight: number) => set((state) => ({ lipFactor: weight }))
        }),
        {
            name: 'sentio-basic-storage'
        }
    )
)

// ==================== ASR 相关设置 ==================
interface SentioAsrState {
    enable: boolean,
    engine: string,
    infer_type: IFER_TYPE,
    settings: { [key: string]: any },
    setEnable: (enable: boolean) => void,
    setInferType: (infer_type: IFER_TYPE) => void,
    setEngine: (engine: string) => void,
    setSettings: (settings: { [key: string]: any }) => void,
}

export const useSentioAsrStore = create<SentioAsrState>()(
    persist(
        (set) => ({
            enable: true,
            engine: "default",
            infer_type: IFER_TYPE.NORMAL,
            settings: {},
            setEnable: (enable: boolean) => set((state) => ({ enable: enable })),
            setInferType: (infer_type: IFER_TYPE) => set((state) => ({ infer_type: infer_type })),
            setEngine: (by: string) => set((state) => ({ engine: by })),
            setSettings: (by: { [key: string]: any }) => set((state) => ({ settings: by })),
        }),
        {
            name: 'sentio-asr-storage',
        }
    )
)

// ==================== TTS 相关设置 ==================
interface SentioTtsState {
    enable: boolean,
    engine: string,
    infer_type: IFER_TYPE,
    settings: { [key: string]: any },
    setEnable: (enable: boolean) => void,
    setInferType: (infer_type: IFER_TYPE) => void,
    setEngine: (engine: string) => void,
    setSettings: (settings: { [key: string]: any }) => void
}

export const useSentioTtsStore = create<SentioTtsState>()(
    persist(
        (set) => ({
            enable: true,
            engine: "default",
            infer_type: IFER_TYPE.NORMAL,
            settings: {},
            setEnable: (enable: boolean) => set((state) => ({ enable: enable })),
            setInferType: (infer_type: IFER_TYPE) => set((state) => ({ infer_type: infer_type })),
            setEngine: (by: string) => set((state) => ({ engine: by })),
            setSettings: (by: { [key: string]: any }) => set((state) => ({ settings: by }))
        }),
        {
            name: 'sentio-tts-storage',
        }
    )
)

// ==================== Agent 相关设置 ==================
interface SentioAgentState {
    enable: boolean,
    engine: string,
    infer_type: IFER_TYPE,
    settings: { [key: string]: any },
    setEnable: (enable: boolean) => void,
    setInferType: (infer_type: IFER_TYPE) => void,
    setEngine: (engine: string) => void,
    setSettings: (settings: { [key: string]: any }) => void
}

export const useSentioAgentStore = create<SentioAgentState>()(
    persist(
        (set) => ({
            enable: true,
            engine: "default",
            infer_type: IFER_TYPE.NORMAL,
            settings: {},
            // setEnable: (enable: boolean) => set((state) => ({ enable: enable })),
            setEnable: (enable: boolean) => set((state) => ({})),
            setInferType: (infer_type: IFER_TYPE) => set((state) => ({ infer_type: infer_type })),
            setEngine: (by: string) => set((state) => ({ engine: by })),
            setSettings: (by: { [key: string]: any }) => set((state) => ({ settings: by }))
        }),
        {
            name: 'sentio-agent-storage',
        }
    )
)

// ==================== 背景选择 ==================
interface SentioBackgroundState {
    background: ResourceModel | null,
    setBackground: (background: ResourceModel | null) => void
}
export const useSentioBackgroundStore = create<SentioBackgroundState>()(
    persist(
        (set) => ({
            background: {
                name: "简约",
                //link: `/${CONSTANTS.SENTIO_BACKGROUND_STATIC_PATH}/简约.jpg`,
                link: "/pic/playground.jpg", 
                type: RESOURCE_TYPE.BACKGROUND,
                resource_id: "playground"
            },
            setBackground: (by: ResourceModel | null) => set((state) => ({ background: by })),
        }),
        {
            name: 'sentio-background-storage',
        }
    )
)

// ==================== 人物选择 ==================
interface SentioCharacterState {
    character: ResourceModel | null,
    setCharacter: (character: ResourceModel | null) => void
}
export const useSentioCharacterStore = create<SentioCharacterState>()(
    persist(
        (set) => ({
            character: null,
            setCharacter: (by: ResourceModel | null) => set((state) => ({ character: by })),
        }),
        {
            name: 'sentio-character-storage',
        }
    )
)

// ==================== 聊天模式 ==================
interface SentioChatModeState {
    chatMode: CHAT_MODE,
    setChatMode: (chatMode: CHAT_MODE) => void
}
export const useSentioChatModeStore = create<SentioChatModeState>()(
    persist(
        (set) => ({
            chatMode: CONSTANTS.SENTIO_CHATMODE_DEFULT,
            setChatMode: (by: CHAT_MODE) => set((state) => ({ chatMode: by })),
        }),
        {
            name: 'sentio-chat-mode-storage',
        }
    )
)

// ==================== 主题 ==================
interface SentioThemeState {
    theme: APP_TYPE,
    setTheme: (theme: APP_TYPE) => void
}
export const useSentioThemeStore = create<SentioThemeState>()(
    persist(
        (set) => ({
            theme: CONSTANTS.SENTIO_THENE_DEFAULT,
            // setTheme: (by: APP_TYPE) => set((state) => ({ theme: by })),
            setTheme: (by: APP_TYPE) => set((state) => ({ theme: by })),
        }),
        {
            name: 'sentio-theme-storage',
        }
    )
)


// ==================== live2d ==================
interface SentioLive2DState {
    ready: boolean,
    setReady: (enable: boolean) => void
}

export const useSentioLive2DStore = create<SentioLive2DState>()(
    (set) => ({
        ready: false,
        setReady: (ready: boolean) => set((state) => ({ ready: ready })),
    })
)