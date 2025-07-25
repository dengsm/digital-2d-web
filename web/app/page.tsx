'use client'

import { useEffect } from 'react'
import { redirect, useRouter } from 'next/navigation'

// 直接跳转页面
export default function Page() {
  // const router = useRouter();
  
  // useEffect(() => {
  //   router.push('/sentio');
  // }, [router]);

  // // Return a loading state while redirecting
  // return (
  //   <div className="flex items-center justify-center min-h-screen">
  //     <div className="text-center">
  //       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
  //       <p className="text-white">正在跳转...</p>
  //     </div>
  //   </div>
  // );
  redirect('/chat');
}