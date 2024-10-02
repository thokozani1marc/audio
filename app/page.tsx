// app/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyBiKj0ETNBhsd8nFh_IvLdRR9pfy8Z26ng';
const genAI = new GoogleGenerativeAI(API_KEY);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUESTS_PER_MINUTE = 10;
const REQUEST_INTERVAL = 60 * 1000;
const SUPPORTED_FORMATS = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg'];

const isAudioFormatSupported = (file: File): boolean => SUPPORTED_FORMATS.includes(file.type);

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [requestCount, setRequestCount] = useState<number>(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFile = event.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
      }
      if (!isAudioFormatSupported(selectedFile)) {
        setError('Unsupported audio format. Please upload an MP3, WAV, or OGG file.');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
      setError(`Rate limit exceeded. Please wait before making another request.`);
      return;
    }

    setIsLoading(true);
    setError('');
    setProgress(0);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const arrayBuffer = await file.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);

      const result = await model.generateContent([
        "Transcribe the following audio:",
        {
          inlineData: {
            mimeType: file.type,
            data: base64Audio
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      setTranscript(text);
      setRequestCount(prevCount => prevCount + 1);

      setTimeout(() => setRequestCount(prevCount => Math.max(prevCount - 1, 0)), REQUEST_INTERVAL);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setError('Error transcribing audio. Please try again.');
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }, [file, requestCount]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-4xl font-bold mb-6 text-center text-gray-800">Audio Transcription App</h1>
        <p className="mb-6 text-center text-gray-600">
          Supported formats: MP3, WAV, OGG | Maximum file size: 10MB
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500">MP3, WAV, or OGG (MAX. 10MB)</p>
              </div>
              <input id="dropzone-file" type="file" className="hidden" accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/ogg" onChange={handleFileChange} />
            </label>
          </div>
          {file && <p className="text-sm text-gray-600">Selected file: {file.name}</p>}
          <button
            type="submit"
            disabled={!file || isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Transcribing...' : 'Transcribe Audio'}
          </button>
        </form>
        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        {isLoading && (
          <div className="mt-4">
            <div className="bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{width: `${progress}%`}}
              ></div>
            </div>
            <p className="text-center mt-2 text-gray-600">{progress}% Complete</p>
          </div>
        )}
        {transcript && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Transcript:</h2>
            <p className="whitespace-pre-wrap text-gray-700 bg-gray-100 p-4 rounded-lg">{transcript}</p>
          </div>
        )}
      </div>
    </main>
  );
}