'use client'

import { useEffect } from 'react'
import { redirect, useRouter } from 'next/navigation'
// 客户端重定向页面
export default function Page() {
  redirect('/chat');
}