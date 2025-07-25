'use client'

import React, { useEffect, useState } from 'react';
import { LAppDelegate } from '@/lib/live2d/src/lappdelegate';
import * as LAppDefine from '@/lib/live2d/src/lappdefine';
import { Spinner } from '@heroui/react';
import { useSentioBackgroundStore } from "@/lib/store/sentio";
import { useTranslations } from 'next-intl';
import { useLive2D } from '../hooks/live2d';

export function Live2d() {
    const t = useTranslations('Products.sentio');
    const { ready } = useLive2D();
    const { background } = useSentioBackgroundStore();

    const handleLoad = () => {
        try {
            const delegate = LAppDelegate.getInstance();
            if (!delegate) {
                console.error('LAppDelegate instance is null');
                return;
            }
            if (delegate.initialize() === false) {
                console.error('Failed to initialize LAppDelegate');
                return;
            }
            delegate.run();
        } catch (error) {
            console.error('Error in Live2D handleLoad:', error);
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
            console.error('Error in Live2D handleResize:', error);
        }
    }

    const handleBeforeUnload = () => {
        try {
            // 释放实例
            LAppDelegate.releaseInstance();
        } catch (error) {
            console.error('Error in Live2D cleanup:', error);
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
                background && (background.link.endsWith('.mp4') ? 
                <video 
                    className='absolute top-0 left-0 w-full h-full object-cover z-[-1]' 
                    autoPlay 
                    muted 
                    loop
                    src={background.link}
                    style={{ pointerEvents: 'none' }}
                />
                :
                <img 
                    src={background.link}
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
                className='w-full h-full bg-center bg-cover'
                style={{
                    display: 'block',
                    touchAction: 'none'
                }}
                onError={(e) => {
                    console.error('Canvas error:', e);
                }}
            />
        </div>   
    )
}