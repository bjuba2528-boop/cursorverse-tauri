// Audio recorder implementation
use super::{AudioData, AudioConfig, AppResult, AppError};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

pub struct AudioRecorder {
    recording: Arc<Mutex<bool>>,
    buffer: Arc<Mutex<Vec<AudioData>>>,
    config: AudioConfig,
    output_dir: PathBuf,
}

impl AudioRecorder {
    pub fn new(config: AudioConfig, output_dir: PathBuf) -> Self {
        Self {
            recording: Arc::new(Mutex::new(false)),
            buffer: Arc::new(Mutex::new(Vec::new())),
            config,
            output_dir,
        }
    }
    
    pub fn start_recording(&self) -> AppResult<()> {
        let mut recording = self.recording.lock().unwrap();
        if *recording {
            return Ok(());
        }
        
        *recording = true;
        
        // Clear previous recording
        let mut buffer = self.buffer.lock().unwrap();
        buffer.clear();
        
        Ok(())
    }
    
    pub fn stop_recording(&self) -> AppResult<()> {
        let mut recording = self.recording.lock().unwrap();
        *recording = false;
        Ok(())
    }
    
    pub fn is_recording(&self) -> bool {
        *self.recording.lock().unwrap()
    }
    
    pub fn add_audio_data(&self, audio_data: AudioData) -> AppResult<()> {
        if self.is_recording() {
            let mut buffer = self.buffer.lock().unwrap();
            buffer.push(audio_data);
        }
        Ok(())
    }
    
    pub fn get_recording(&self) -> Option<Vec<f32>> {
        if !self.is_recording() && self.buffer.lock().unwrap().len() > 0 {
            let buffer = self.buffer.lock().unwrap();
            let mut combined = Vec::new();
            
            for audio_data in buffer.iter() {
                combined.extend(&audio_data.samples);
            }
            
            Some(combined)
        } else {
            None
        }
    }
    
    pub fn save_recording(&self, filename: &str) -> AppResult<PathBuf> {
        let recording = self.get_recording()
            .ok_or_else(|| AppError::Audio("No recording to save".to_string()))?;
        
        let output_path = self.output_dir.join(format!("{}.wav", filename));
        
        // Save as WAV file (implementation would go here)
        self.save_as_wav(&recording, &output_path)?;
        
        Ok(output_path)
    }
    
    fn save_as_wav(&self, samples: &[f32], path: &PathBuf) -> AppResult<()> {
        use std::fs::File;
        use std::io::Write;
        
        let mut file = File::create(path)?;
        
        // WAV header
        let sample_rate = self.config.sample_rate;
        let channels = self.config.channels;
        let byte_rate = sample_rate * channels * 2; // 16-bit samples
        let block_align = channels * 2;
        let data_size = samples.len() * 2;
        
        // RIFF header
        file.write_all(b"RIFF")?;
        file.write_all(&(36 + data_size).to_le_bytes())?; // File size - 8
        file.write_all(b"WAVE")?;
        
        // Format chunk
        file.write_all(b"fmt ")?;
        file.write_all(&16u32.to_le_bytes())?; // Chunk size
        file.write_all(&1u16.to_le_bytes())?;  // Audio format (PCM)
        file.write_all(&channels.to_le_bytes())?;
        file.write_all(&sample_rate.to_le_bytes())?;
        file.write_all(&byte_rate.to_le_bytes())?;
        file.write_all(&block_align.to_le_bytes())?;
        file.write_all(&16u16.to_le_bytes())?; // Bits per sample
        
        // Data chunk
        file.write_all(b"data")?;
        file.write_all(&data_size.to_le_bytes())?;
        
        // Convert f32 samples to 16-bit PCM
        for &sample in samples {
            let pcm_sample = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
            file.write_all(&pcm_sample.to_le_bytes())?;
        }
        
        Ok(())
    }
    
    pub fn clear_recording(&self) {
        let mut buffer = self.buffer.lock().unwrap();
        buffer.clear();
    }
    
    pub fn get_recording_duration(&self) -> f64 {
        let buffer = self.buffer.lock().unwrap();
        let total_samples: usize = buffer.iter()
            .map(|data| data.samples.len())
            .sum();
        
        (total_samples as f64 / self.config.sample_rate as f64) * 1000.0
    }
}