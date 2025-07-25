#!/usr/bin/env python
# -*- coding: utf-8 -*-

'''
测试脚本：验证截图保存功能
'''

import os
import base64
import sys
from datetime import datetime

def create_test_image():
    """
    创建一个简单的测试图片，返回base64编码
    """
    # 创建一个1x1像素的红色PNG图片
    # 这是一个最小的PNG图像的base64编码
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

def save_screenshot_direct(image_data_url):
    """
    直接实现截图保存功能，不依赖原代码
    参数:
        image_data_url: base64编码的图片数据，形如"data:image/png;base64,XXXX"
    返回:
        保存成功时返回文件路径，失败时返回None
    """
    print("开始解析图片数据...")
    
    # 1. 检查数据是否有效
    if not image_data_url or not isinstance(image_data_url, str):
        print("错误: 图片数据无效")
        return None
    
    # 2. 解析base64数据
    if image_data_url.startswith('data:'):
        try:
            # 切分头部信息和base64数据
            header, encoded = image_data_url.split(',', 1)
            print(f"成功提取base64数据，头部信息: {header}")
            
            # 进行base64解码
            try:
                image_data = base64.b64decode(encoded)
                print(f"成功解码base64数据，长度: {len(image_data)} 字节")
            except Exception as e:
                print(f"解码base64数据失败: {str(e)}")
                return None
        except Exception as e:
            print(f"解析数据格式失败: {str(e)}")
            return None
    else:
        print("错误: 图片数据不是data URL格式")
        return None
    
    # 3. 准备保存文件
    # 创建logs目录(如果不存在)
    log_dir = "logs"
    if not os.path.exists(log_dir):
        try:
            os.makedirs(log_dir)
            print(f"创建{log_dir}目录成功")
        except Exception as e:
            print(f"创建{log_dir}目录失败: {str(e)}")
            return None
    
    # 生成文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"screenshot_{timestamp}.png"
    filepath = os.path.join(log_dir, filename)
    
    # 4. 保存文件
    try:
        with open(filepath, "wb") as f:
            f.write(image_data)
        print(f"成功将图片保存到: {filepath}")
        return filepath
    except Exception as e:
        print(f"保存图片数据到文件失败: {str(e)}")
        return None

def test_save_screenshot():
    """
    测试保存截图功能
    """
    print("开始测试截图保存功能...")
    
    # 1. 创建测试图片数据
    image_data = create_test_image()
    print(f"创建测试图片数据，长度: {len(image_data)}")
    
    # 2. 添加data:image/png;base64,前缀模拟真实场景
    image_data_with_prefix = f"data:image/png;base64,{image_data}"
    
    # 3. 测试保存功能
    try:
        print("尝试保存截图...")
        saved_path = save_screenshot_direct(image_data_with_prefix)
        
        if saved_path:
            print(f"截图保存成功: {saved_path}")
            if os.path.exists(saved_path):
                print(f"文件确实存在，大小: {os.path.getsize(saved_path)} 字节")
            else:
                print(f"错误：保存路径返回成功，但文件不存在: {saved_path}")
        else:
            print("错误：截图保存失败，返回路径为空")
    
    except Exception as e:
        import traceback
        print(f"错误：截图保存过程发生异常: {str(e)}")
        print(f"详细错误信息: {traceback.format_exc()}")

def test_logs_directory():
    """
    测试logs目录的权限和路径
    """
    log_dir = "logs"
    abs_log_dir = os.path.abspath(log_dir)
    
    print(f"当前工作目录: {os.getcwd()}")
    print(f"logs目录绝对路径: {abs_log_dir}")
    
    # 检查目录是否存在
    if os.path.exists(log_dir):
        print(f"logs目录已存在")
        
        # 检查是否为目录
        if os.path.isdir(log_dir):
            print("logs是一个目录")
        else:
            print("错误：logs存在但不是一个目录")
        
        # 检查权限
        if os.access(log_dir, os.W_OK):
            print("logs目录有写入权限")
        else:
            print("错误：logs目录没有写入权限")
    else:
        print("logs目录不存在，尝试创建")
        try:
            os.makedirs(log_dir)
            print("logs目录创建成功")
        except Exception as e:
            print(f"创建logs目录失败: {str(e)}")

if __name__ == "__main__":
    # 测试logs目录
    test_logs_directory()
    
    # 测试截图保存
    test_save_screenshot()
    
    # 列出logs目录下的所有文件
    log_dir = "logs"
    if os.path.exists(log_dir) and os.path.isdir(log_dir):
        files = os.listdir(log_dir)
        print(f"\n{log_dir}目录下的文件:")
        for file in files:
            file_path = os.path.join(log_dir, file)
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            print(f"  - {file} ({file_size} 字节)")
    else:
        print(f"\n{log_dir}目录不存在或不是目录")
        
    print("测试完成")
