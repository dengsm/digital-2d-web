import { Live2dManager } from "@/lib/live2d/live2dManager";
import { useSentioLive2DStore } from "@/lib/store/sentio";
import { ResourceModel } from "@/lib/protocol";

export const useLive2D = () => {
    const { ready, setReady } = useSentioLive2DStore();

    const checkLive2DReady = () => {
        if (Live2dManager.getInstance().isReady()) {
            setReady(true);
        } else {
            setTimeout(checkLive2DReady, 1000);
        }
    }

    const setLive2dCharacter = (character: ResourceModel| null) => {
        try {
            const manager = Live2dManager.getInstance();
            if (manager) {
                manager.changeCharacter(character);
                if (character != null) {
                    setReady(false);
                    checkLive2DReady();
                }
            } else {
                console.error('Live2dManager instance is null');
            }
        } catch (error) {
            console.error('Error in setLive2dCharacter:', error);
            // 如果出错，确保ready状态正确
            setReady(false);
        }
    };

    return {
        setLive2dCharacter,
        ready,
    };
}