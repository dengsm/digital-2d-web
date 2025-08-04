'use client'

import { useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDraggable,
    useDisclosure
} from "@heroui/react";
import { Tabs, Tab } from "@heroui/react";
import { useSentioThemeStore } from '@/lib/store/sentio';
import { BasicTab } from './components/settings/basic';
import { ASRTab, TTSTab, AgentTab } from './components/settings/engine'
import { APP_TYPE } from '@/lib/protocol';

function FreedomSettingsTabs() {
    const t = useTranslations('Products.sentio.settings');
    return (
        <Tabs aria-label="Settings" destroyInactiveTabPanel={false}>
            <Tab key='basic' title={t('basic.title')}>
                <BasicTab />
            </Tab>
            <Tab key='asr' title={t('asr.title')}>
                <ASRTab />
            </Tab>
            <Tab key='tts' title={t('tts.title')}>
                <TTSTab />
            </Tab>
            <Tab key='agent' title={t('agent.title')}>
                <AgentTab />
            </Tab>
        </Tabs>
    )
}


function SettingsTabs() {
    const { theme } = useSentioThemeStore();
    switch (theme) {
        case APP_TYPE.FREEDOM:
            return <FreedomSettingsTabs />
        default:
            return <FreedomSettingsTabs />
    }
}

export function Settings({ isOpen: open, onClose }: { isOpen: boolean, onClose: () => void }) {
    const t_common = useTranslations('Common');
    const t = useTranslations('Products.sentio.settings');
    const { isOpen, onOpen, onOpenChange } = useDisclosure({ isOpen: open, onClose });
    const targetRef = useRef(null);
    // 🔧 在这里添加以下代码 ⬇️
    useEffect(() => {
        const originalError = console.error;
        console.error = (...args) => {
            if (typeof args[0] === 'string' && args[0].includes('inert')) {
                // 抑制 inert 属性相关的警告
                return;
            }
            originalError.apply(console, args);
        };
        
        return () => {
            console.error = originalError;
        };
    }, []);
    // 🔧 在这里添加以上代码 ⬆️
    const { moveProps } = useDraggable({ targetRef, isDisabled: !isOpen });
    return (
        <Modal
            ref={targetRef}
            isOpen={open}
            onOpenChange={onOpenChange}
            size="3xl"
            placement="top"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader {...moveProps}>{t('title')}</ModalHeader>
                <ModalBody className="no-scrollbar">
                    <SettingsTabs />
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose}>
                        {t_common('close')}
                    </Button>
                    {/* <Button color="primary" type="submit">
                        {t_common('ok')}
                    </Button> */}
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}