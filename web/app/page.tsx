'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 客户端重定向页面
export default function Page() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/sentio');
  }, [router]);

  // Return a loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-purple-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white">正在跳转到数字人助手...</p>
      </div>
    </div>
  );
}