// Audio analyzer implementation
use super::{AudioData, AudioAnalyzer as BaseAnalyzer};

pub struct AudioAnalyzer {
    analyzer: BaseAnalyzer,
}

impl AudioAnalyzer {
    pub fn new() -> Self {
        Self {
            analyzer: BaseAnalyzer::new(),
        }
    }
    
    pub fn analyze(&mut self, audio_data: &AudioData) -> AnalysisResult {
        let clap_detected = self.analyzer.detect_clap(audio_data);
        let voice_activity = self.analyzer.detect_voice_activity(audio_data);
        let spectrum = self.analyzer.analyze_spectrum(audio_data);
        let rms = audio_data.rms();
        let peak = audio_data.peak();
        
        AnalysisResult {
            rms,
            peak,
            clap_detected,
            voice_activity,
            spectrum,
            duration_ms: audio_data.duration_ms(),
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AnalysisResult {
    pub rms: f32,
    pub peak: f32,
    pub clap_detected: Option<f32>,
    pub voice_activity: bool,
    pub spectrum: Vec<f32>,
    pub duration_ms: f64,
}