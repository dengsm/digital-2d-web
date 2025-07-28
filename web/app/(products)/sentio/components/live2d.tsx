'use client'

import React, { useEffect, useState, useRef } from 'react';
import { LAppDelegate } from '@/lib/live2d/src/lappdelegate';
import * as LAppDefine from '@/lib/live2d/src/lappdefine';
import { Spinner } from '@heroui/react';
import { useSentioBackgroundStore } from "@/lib/store/sentio";
import { useTranslations } from 'next-intl';
import { useLive2D } from '../hooks/live2d';
import { getSrcPath } from '@/lib/path';

export function Live2d() {
    const t = useTranslations('Products.sentio');
    const { ready, setLive2dCharacter } = useLive2D();
    const { background } = useSentioBackgroundStore();
    const canvasRef = useRef(null);
    

    
    // 确保有默认背景
    const effectiveBackground = background || {
        name: "简约",
        link: "/pic/playground.jpg",
        type: "BACKGROUND" as any,
        resource_id: "playground"
    };

    // 动态加载Live2D Core脚本
    const loadLive2DCore = () => {
        return new Promise((resolve, reject) => {
            // 检查脚本是否已经加载
            if (document.querySelector('script[src*="live2dcubismcore.min.js"]')) {
                resolve(true);
                return;
            }
            
            const script = document.createElement('script');
            script.src = getSrcPath('sentio/core/live2dcubismcore.min.js');
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('Failed to load Live2D Core'));
            document.head.appendChild(script);
        });
    };

    const handleLoad = async () => {
        try {
            // 先加载Live2D Core脚本
            await loadLive2DCore();
            
            const delegate = LAppDelegate.getInstance();
            if (!delegate) {
                // console.error('LAppDelegate instance is null');
                return;
            }
            if (delegate.initialize() === false) {
                // console.error('Failed to initialize LAppDelegate');
                return;
            }
            delegate.run();
        } catch (error) {
            // console.error('Error in Live2D handleLoad:', error);
        }
    }

    const handleResize = () => {
        try {
            if (LAppDefine.CanvasSize === 'auto') {
                const delegate = LAppDelegate.getInstance();
                if (delegate && delegate.onResize) {
                    delegate.onResize();
                }
            }
        } catch (error) {
            // console.error('Error in Live2D handleResize:', error);
        }
    }

    const handleBeforeUnload = () => {
        try {
            // 释放实例
            LAppDelegate.releaseInstance();
        } catch (error) {
            // console.error('Error in Live2D cleanup:', error);
        }
    }

    // useEffect(() => {
    //     // 切换背景图
    //     if (canvasRef.current) {
    //         if (background) {
    //             canvasRef.current.style.backgroundImage = `url('${background.link}')`;
    //         } else {
    //             canvasRef.current.style.backgroundImage = 'none';
    //         }
    //     }
    // }, [background])

    useEffect(() => {
        // 延迟初始化，确保DOM已经加载完成
        const timer = setTimeout(() => {
            handleLoad();
            
            // 初始化后强制设置Canvas背景为透明
            const canvas = document.getElementById('live2dCanvas') as HTMLCanvasElement;
            if (canvas) {
                canvas.style.backgroundColor = 'transparent';
                canvas.style.background = 'none';
                // console.log('Forced canvas background to transparent');
            }
        }, 100);
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload();
        }
    }, []);

    return (
        <div id='live2d-container' className='absolute top-0 left-0 w-full h-full z-0'>
            {
                effectiveBackground && (effectiveBackground.link.endsWith('.mp4') ? 
                <video 
                    className='absolute top-0 left-0 w-full h-full object-cover z-[-1]' 
                    autoPlay 
                    muted 
                    loop
                    src={effectiveBackground.link}
                    style={{ pointerEvents: 'none' }}
                />
                :
                <img 
                    src={effectiveBackground.link}
                    alt="Background Image"
                    className='absolute top-0 left-0 w-full h-full object-cover z-[-1]'
                />
                )
            }
            {
                !ready &&  <div className='absolute top-0 left-0 w-full h-full flex flex-row gap-1 items-center justify-center z-50'>
                    <p className='text-xl font-bold'>{t('loading')}</p>
                    <Spinner color='warning' variant="dots" size='lg'/>
                </div>
            }
            <canvas
                id="live2dCanvas"
                className='w-full h-full'
                style={{
                    display: 'block',
                    touchAction: 'none',
                    backgroundColor: 'transparent',
                    background: 'none',
                    opacity: ready ? 1 : 0, 
                    transition: 'opacity 0.3s ease-in-out',
                    transform: 'scale(0.5)',
                    transformOrigin: 'center center'
                }}
            />
        </div>   
    )
}