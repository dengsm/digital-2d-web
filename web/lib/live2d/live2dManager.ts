import { LAppDelegate } from '@/lib/live2d/src/lappdelegate';
import { ResourceModel } from '@/lib/protocol';

export class Live2dManager {
    // 单例
    public static getInstance(): Live2dManager {
        if (! this._instance) {
            this._instance = new Live2dManager();
        }

        return this._instance;
    }

    public setReady(ready: boolean) {
      this._ready = ready;
    }

    public isReady(): boolean {
      return this._ready;
    }

    public changeCharacter(character: ResourceModel | null) {
      this._ready = true;
      return; 
      // // _subdelegates中只有一个画布, 所以设置第一个即可
      // this._ready = false;
      // try {
      //   const delegate = LAppDelegate.getInstance();
      //   if (delegate) {
      //     delegate.changeCharacter(character);
      //   } else {
      //     // console.error('LAppDelegate instance is null');
      //   }
      // } catch (error) {
      //   // console.error('Error changing character in Live2dManager:', error);
      // }
    }

    public setLipFactor(weight: number): void {
      this._lipFactor = weight;
    }

    public getLipFactor(): number {
      return this._lipFactor;
    }

    public pushAudioQueue(audioData: ArrayBuffer): void {
      console.log('🔊 将音频数据添加到队列，当前队列长度:', this._ttsQueue.length);
      this._ttsQueue.push(audioData);
      
      // 如果没有正在播放的音频，则开始播放
      if (!this._audioIsPlaying) {
        console.log('🔊 当前没有音频在播放，开始播放新音频');
        this.playAudio();
      } else {
        console.log('🔊 当前有音频正在播放，将新音频加入队列等待');
      }
    }

    public popAudioQueue(): ArrayBuffer | null {
      if (this._ttsQueue.length > 0) {
        const audioData = this._ttsQueue.shift();
        return audioData;
      } else {
        return null;
      }
    }

    public clearAudioQueue(): void {
      this._ttsQueue = [];
    }

    public playAudio(): ArrayBuffer | null {
      console.log('🔊 尝试播放音频，当前播放状态:', this._audioIsPlaying);
      if (this._audioIsPlaying) {
        console.log('🔊 音频正在播放，跳过本次播放');
        return null; // 如果正在播放则返回
      }
      const audioData = this.popAudioQueue();
      if (audioData == null) return null; // 没有音频数据则返回
      this._audioIsPlaying = true;
      // 播放音频
      const playAudioBuffer = (buffer: AudioBuffer) => {
        var source = this._audioContext.createBufferSource();
        source.buffer = buffer;
        
        source.connect(this._audioContext.destination);
        // 监听音频播放完毕事件
        source.onended = () => {
          console.log('🔊 音频播放结束');
          this._audioIsPlaying = false;
          // 检查队列中是否还有待播放的音频
          if (this._ttsQueue.length > 0) {
            console.log('🔊 队列中还有待播放的音频，继续播放下一段');
            setTimeout(() => this.playAudio(), 100); // 添加小延迟避免可能的竞态条件
          }
        };
        source.start();
        this._audioSource = source;
      }
      // 创建一个新的 ArrayBuffer 并复制数据, 防止原始数据被decodeAudioData释放
      const newAudioData = audioData.slice(0);
      this._audioContext.decodeAudioData(newAudioData).then(
        buffer => {
          playAudioBuffer(buffer);
        }
      );
      return audioData;
    }

    public stopAudio(): void {
      this.clearAudioQueue();
      if (this._audioSource) {
        this._audioSource.stop();
        this._audioSource = null;
      }
      this._audioIsPlaying = false;
    }

    public isAudioPlaying(): boolean {
      return this._audioIsPlaying;
    }

    constructor() {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this._audioIsPlaying = false;
      this._audioSource = null;
      this._lipFactor = 1.0;
      this._ready = false;
    }

    private static _instance: Live2dManager;
    private _ttsQueue: ArrayBuffer[] = [];
    private _audioContext: AudioContext;
    private _audioIsPlaying: boolean;
    private _audioSource: AudioBufferSourceNode | null;
    private _lipFactor: number;
    private _ready: boolean;
  }