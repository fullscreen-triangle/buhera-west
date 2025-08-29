use anyhow::Result;
use serde::{Serialize, Deserialize};
use ndarray::{Array3, Array2};
use std::collections::HashMap;

/// Fuzzy Atmospheric Molecular Processor Network
/// Continuous state management for atmospheric molecules using fuzzy logic
/// Every molecule operates in continuous fuzzy states rather than discrete binary states
#[derive(Debug)]
pub struct FuzzyAtmosphericMolecularNetwork {
    /// Fuzzy processor state matrices
    fuzzy_processor_states: Array3<FuzzyMolecularProcessorState>,
    
    /// Fuzzy membership functions for different atmospheric conditions
    membership_functions: AtmosphericMembershipFunctions,
    
    /// Fuzzy rule base for atmospheric coordination
    rule_base: FuzzyRuleBase,
    
    /// Fuzzy inference engine
    inference_engine: FuzzyInferenceEngine,
    
    /// Grid dimensions and scale
    grid_dims: (usize, usize, usize),
    scale_km: f64,
}

/// Fuzzy state of atmospheric molecular processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzyMolecularProcessorState {
    /// Fuzzy frequency membership values (low, medium, high)
    pub frequency_membership: [f64; 3],
    
    /// Fuzzy coordination level (weak, moderate, strong)
    pub coordination_membership: [f64; 3],
    
    /// Fuzzy energy output (minimal, moderate, maximum)
    pub energy_output_membership: [f64; 3],
    
    /// Fuzzy information transfer rate (slow, medium, fast)
    pub information_transfer_membership: [f64; 3],
    
    /// Fuzzy physical state memberships
    pub temperature_membership: [f64; 5], // very_cold, cold, normal, warm, hot
    pub pressure_membership: [f64; 5],    // very_low, low, normal, high, very_high
    pub humidity_membership: [f64; 5],    // very_dry, dry, normal, humid, very_humid
    
    /// Fuzzy coordination target memberships
    pub target_frequency_membership: [f64; 3],
    pub target_energy_membership: [f64; 3],
    
    /// Defuzzified crisp values for API compatibility
    pub crisp_frequency: f64,
    pub crisp_coordination: f64,
    pub crisp_energy_output: f64,
}

/// Atmospheric membership functions for fuzzy sets
#[derive(Debug)]
pub struct AtmosphericMembershipFunctions {
    /// Temperature fuzzy sets (Kelvin)
    temperature_sets: FuzzySetCollection,
    
    /// Pressure fuzzy sets (Pascal)
    pressure_sets: FuzzySetCollection,
    
    /// Humidity fuzzy sets (percentage)
    humidity_sets: FuzzySetCollection,
    
    /// Frequency fuzzy sets (Hz)
    frequency_sets: FuzzySetCollection,
    
    /// Energy output fuzzy sets (Watts)
    energy_sets: FuzzySetCollection,
}

/// Collection of fuzzy sets for a variable
#[derive(Debug)]
pub struct FuzzySetCollection {
    /// Fuzzy set definitions (name, parameters)
    sets: HashMap<String, FuzzySet>,
}

/// Individual fuzzy set definition
#[derive(Debug, Clone)]
pub struct FuzzySet {
    /// Set name
    pub name: String,
    
    /// Membership function type
    pub function_type: MembershipFunctionType,
    
    /// Function parameters
    pub parameters: Vec<f64>,
}

/// Types of membership functions
#[derive(Debug, Clone)]
pub enum MembershipFunctionType {
    /// Triangular: [left, center, right]
    Triangular,
    
    /// Trapezoidal: [left, left_top, right_top, right]
    Trapezoidal,
    
    /// Gaussian: [center, width]
    Gaussian,
    
    /// Sigmoid: [center, slope]
    Sigmoid,
}

/// Fuzzy rule base for atmospheric coordination
#[derive(Debug)]
pub struct FuzzyRuleBase {
    /// Collection of fuzzy rules
    rules: Vec<FuzzyRule>,
}

/// Individual fuzzy rule
#[derive(Debug, Clone)]
pub struct FuzzyRule {
    /// Rule identifier
    pub id: String,
    
    /// Antecedent conditions (IF part)
    pub antecedents: Vec<FuzzyCondition>,
    
    /// Consequent actions (THEN part)
    pub consequents: Vec<FuzzyAction>,
    
    /// Rule weight (0.0 to 1.0)
    pub weight: f64,
}

/// Fuzzy condition in rule antecedent
#[derive(Debug, Clone)]
pub struct FuzzyCondition {
    /// Variable name (e.g., "temperature", "pressure")
    pub variable: String,
    
    /// Fuzzy set name (e.g., "high", "low")
    pub fuzzy_set: String,
    
    /// Logical operator for combining conditions
    pub operator: Option<FuzzyOperator>,
}

/// Fuzzy action in rule consequent
#[derive(Debug, Clone)]
pub struct FuzzyAction {
    /// Output variable name
    pub variable: String,
    
    /// Target fuzzy set
    pub fuzzy_set: String,
    
    /// Action strength
    pub strength: f64,
}

/// Fuzzy logical operators
#[derive(Debug, Clone)]
pub enum FuzzyOperator {
    And,
    Or,
    Not,
}

/// Fuzzy inference engine
#[derive(Debug)]
pub struct FuzzyInferenceEngine {
    /// Inference method
    method: InferenceMethod,
    
    /// Defuzzification method
    defuzzification: DefuzzificationMethod,
}

/// Fuzzy inference methods
#[derive(Debug)]
pub enum InferenceMethod {
    /// Mamdani inference
    Mamdani,
    
    /// Sugeno inference
    Sugeno,
    
    /// Tsukamoto inference
    Tsukamoto,
}

/// Defuzzification methods
#[derive(Debug)]
pub enum DefuzzificationMethod {
    /// Centroid method
    Centroid,
    
    /// Bisector method
    Bisector,
    
    /// Mean of maximum
    MeanOfMaximum,
    
    /// Smallest of maximum
    SmallestOfMaximum,
    
    /// Largest of maximum
    LargestOfMaximum,
}

impl FuzzyAtmosphericMolecularNetwork {
    /// Initialize fuzzy atmospheric molecular processor network
    pub async fn new() -> Result<Self> {
        let grid_dims = (50, 50, 20); // 2km horizontal, 1km vertical resolution
        let scale_km = 2.0;
        
        // Initialize fuzzy processor states
        let fuzzy_processor_states = Self::initialize_fuzzy_states(grid_dims);
        
        // Initialize membership functions
        let membership_functions = Self::initialize_membership_functions();
        
        // Initialize fuzzy rule base
        let rule_base = Self::initialize_fuzzy_rules();
        
        // Initialize inference engine
        let inference_engine = FuzzyInferenceEngine {
            method: InferenceMethod::Mamdani,
            defuzzification: DefuzzificationMethod::Centroid,
        };
        
        Ok(Self {
            fuzzy_processor_states,
            membership_functions,
            rule_base,
            inference_engine,
            grid_dims,
            scale_km,
        })
    }
    
    /// Initialize fuzzy processor states across the atmospheric grid
    fn initialize_fuzzy_states(grid_dims: (usize, usize, usize)) -> Array3<FuzzyMolecularProcessorState> {
        let mut states = Array3::from_elem(grid_dims, FuzzyMolecularProcessorState {
            frequency_membership: [0.0, 1.0, 0.0], // Start with medium frequency
            coordination_membership: [0.0, 1.0, 0.0], // Start with moderate coordination
            energy_output_membership: [1.0, 0.0, 0.0], // Start with minimal energy
            information_transfer_membership: [0.0, 1.0, 0.0], // Start with medium transfer
            temperature_membership: [0.0, 0.0, 1.0, 0.0, 0.0], // Start with normal temperature
            pressure_membership: [0.0, 0.0, 1.0, 0.0, 0.0], // Start with normal pressure
            humidity_membership: [0.0, 0.0, 1.0, 0.0, 0.0], // Start with normal humidity
            target_frequency_membership: [0.0, 1.0, 0.0],
            target_energy_membership: [0.0, 1.0, 0.0],
            crisp_frequency: 1e12, // Default molecular frequency
            crisp_coordination: 0.5,
            crisp_energy_output: 1e-15,
        });
        
        // Initialize based on altitude and atmospheric conditions
        for ((x, y, z), state) in states.indexed_iter_mut() {
            let altitude_km = z as f64;
            
            // Adjust fuzzy memberships based on altitude
            if altitude_km > 10.0 {
                // High altitude: cold, low pressure
                state.temperature_membership = [0.3, 0.7, 0.0, 0.0, 0.0];
                state.pressure_membership = [0.7, 0.3, 0.0, 0.0, 0.0];
            } else if altitude_km > 5.0 {
                // Medium altitude: moderate conditions
                state.temperature_membership = [0.0, 0.3, 0.7, 0.0, 0.0];
                state.pressure_membership = [0.0, 0.3, 0.7, 0.0, 0.0];
            }
            
            // Set crisp values from fuzzy memberships
            state.crisp_frequency = Self::defuzzify_frequency(&state.frequency_membership);
            state.crisp_coordination = Self::defuzzify_coordination(&state.coordination_membership);
            state.crisp_energy_output = Self::defuzzify_energy(&state.energy_output_membership);
        }
        
        states
    }
    
    /// Initialize atmospheric membership functions
    fn initialize_membership_functions() -> AtmosphericMembershipFunctions {
        let mut temperature_sets = HashMap::new();
        temperature_sets.insert("very_cold".to_string(), FuzzySet {
            name: "very_cold".to_string(),
            function_type: MembershipFunctionType::Trapezoidal,
            parameters: vec![200.0, 200.0, 250.0, 270.0], // Kelvin
        });
        temperature_sets.insert("cold".to_string(), FuzzySet {
            name: "cold".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![250.0, 270.0, 285.0],
        });
        temperature_sets.insert("normal".to_string(), FuzzySet {
            name: "normal".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![280.0, 288.15, 295.0],
        });
        temperature_sets.insert("warm".to_string(), FuzzySet {
            name: "warm".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![290.0, 305.0, 320.0],
        });
        temperature_sets.insert("hot".to_string(), FuzzySet {
            name: "hot".to_string(),
            function_type: MembershipFunctionType::Trapezoidal,
            parameters: vec![315.0, 330.0, 400.0, 400.0],
        });
        
        let mut pressure_sets = HashMap::new();
        pressure_sets.insert("very_low".to_string(), FuzzySet {
            name: "very_low".to_string(),
            function_type: MembershipFunctionType::Trapezoidal,
            parameters: vec![0.0, 0.0, 50000.0, 70000.0],
        });
        pressure_sets.insert("low".to_string(), FuzzySet {
            name: "low".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![60000.0, 80000.0, 95000.0],
        });
        pressure_sets.insert("normal".to_string(), FuzzySet {
            name: "normal".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![90000.0, 101325.0, 110000.0],
        });
        pressure_sets.insert("high".to_string(), FuzzySet {
            name: "high".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![105000.0, 115000.0, 125000.0],
        });
        pressure_sets.insert("very_high".to_string(), FuzzySet {
            name: "very_high".to_string(),
            function_type: MembershipFunctionType::Trapezoidal,
            parameters: vec![120000.0, 130000.0, 200000.0, 200000.0],
        });
        
        let mut humidity_sets = HashMap::new();
        humidity_sets.insert("very_dry".to_string(), FuzzySet {
            name: "very_dry".to_string(),
            function_type: MembershipFunctionType::Trapezoidal,
            parameters: vec![0.0, 0.0, 10.0, 20.0],
        });
        humidity_sets.insert("dry".to_string(), FuzzySet {
            name: "dry".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![15.0, 25.0, 35.0],
        });
        humidity_sets.insert("normal".to_string(), FuzzySet {
            name: "normal".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![30.0, 50.0, 70.0],
        });
        humidity_sets.insert("humid".to_string(), FuzzySet {
            name: "humid".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![65.0, 80.0, 90.0],
        });
        humidity_sets.insert("very_humid".to_string(), FuzzySet {
            name: "very_humid".to_string(),
            function_type: MembershipFunctionType::Trapezoidal,
            parameters: vec![85.0, 95.0, 100.0, 100.0],
        });
        
        let mut frequency_sets = HashMap::new();
        frequency_sets.insert("low".to_string(), FuzzySet {
            name: "low".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![1e10, 1e11, 1e12],
        });
        frequency_sets.insert("medium".to_string(), FuzzySet {
            name: "medium".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![5e11, 1e12, 5e12],
        });
        frequency_sets.insert("high".to_string(), FuzzySet {
            name: "high".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![1e12, 5e12, 1e13],
        });
        
        let mut energy_sets = HashMap::new();
        energy_sets.insert("minimal".to_string(), FuzzySet {
            name: "minimal".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![1e-18, 1e-16, 1e-14],
        });
        energy_sets.insert("moderate".to_string(), FuzzySet {
            name: "moderate".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![1e-15, 1e-13, 1e-11],
        });
        energy_sets.insert("maximum".to_string(), FuzzySet {
            name: "maximum".to_string(),
            function_type: MembershipFunctionType::Triangular,
            parameters: vec![1e-12, 1e-10, 1e-8],
        });
        
        AtmosphericMembershipFunctions {
            temperature_sets: FuzzySetCollection { sets: temperature_sets },
            pressure_sets: FuzzySetCollection { sets: pressure_sets },
            humidity_sets: FuzzySetCollection { sets: humidity_sets },
            frequency_sets: FuzzySetCollection { sets: frequency_sets },
            energy_sets: FuzzySetCollection { sets: energy_sets },
        }
    }
    
    /// Initialize fuzzy rule base for atmospheric coordination
    fn initialize_fuzzy_rules() -> FuzzyRuleBase {
        let mut rules = Vec::new();
        
        // Rule 1: High energy demand requires high frequency and strong coordination
        rules.push(FuzzyRule {
            id: "high_energy_rule".to_string(),
            antecedents: vec![
                FuzzyCondition {
                    variable: "energy_demand".to_string(),
                    fuzzy_set: "high".to_string(),
                    operator: Some(FuzzyOperator::And),
                },
                FuzzyCondition {
                    variable: "temperature".to_string(),
                    fuzzy_set: "normal".to_string(),
                    operator: None,
                },
            ],
            consequents: vec![
                FuzzyAction {
                    variable: "frequency".to_string(),
                    fuzzy_set: "high".to_string(),
                    strength: 0.9,
                },
                FuzzyAction {
                    variable: "coordination".to_string(),
                    fuzzy_set: "strong".to_string(),
                    strength: 0.8,
                },
            ],
            weight: 1.0,
        });
        
        // Rule 2: Cold conditions require moderate frequency coordination
        rules.push(FuzzyRule {
            id: "cold_condition_rule".to_string(),
            antecedents: vec![
                FuzzyCondition {
                    variable: "temperature".to_string(),
                    fuzzy_set: "cold".to_string(),
                    operator: None,
                },
            ],
            consequents: vec![
                FuzzyAction {
                    variable: "frequency".to_string(),
                    fuzzy_set: "medium".to_string(),
                    strength: 0.7,
                },
                FuzzyAction {
                    variable: "coordination".to_string(),
                    fuzzy_set: "moderate".to_string(),
                    strength: 0.6,
                },
            ],
            weight: 0.8,
        });
        
        // Rule 3: High humidity enhances information transfer
        rules.push(FuzzyRule {
            id: "humid_transfer_rule".to_string(),
            antecedents: vec![
                FuzzyCondition {
                    variable: "humidity".to_string(),
                    fuzzy_set: "humid".to_string(),
                    operator: None,
                },
            ],
            consequents: vec![
                FuzzyAction {
                    variable: "information_transfer".to_string(),
                    fuzzy_set: "fast".to_string(),
                    strength: 0.8,
                },
            ],
            weight: 0.9,
        });
        
        // Rule 4: Low pressure reduces coordination effectiveness
        rules.push(FuzzyRule {
            id: "low_pressure_rule".to_string(),
            antecedents: vec![
                FuzzyCondition {
                    variable: "pressure".to_string(),
                    fuzzy_set: "low".to_string(),
                    operator: None,
                },
            ],
            consequents: vec![
                FuzzyAction {
                    variable: "coordination".to_string(),
                    fuzzy_set: "weak".to_string(),
                    strength: 0.7,
                },
            ],
            weight: 0.7,
        });
        
        FuzzyRuleBase { rules }
    }
    
    /// Coordinate fuzzy atmospheric processors to optimal energy endpoint
    pub async fn fuzzy_coordinate_to_endpoint(
        &mut self,
        endpoint: &crate::atmospheric_energy::entropy_navigation::OptimalEnergyEndpoint,
    ) -> Result<()> {
        // Convert endpoint to fuzzy inputs
        let fuzzy_inputs = self.endpoint_to_fuzzy_inputs(endpoint);
        
        // Apply fuzzy inference across all processors
        for ((x, y, z), state) in self.fuzzy_processor_states.indexed_iter_mut() {
            // Run fuzzy inference for this processor
            let inferred_outputs = self.inference_engine.infer(
                &fuzzy_inputs,
                &self.rule_base,
                &self.membership_functions,
            )?;
            
            // Update fuzzy memberships based on inference
            self.update_processor_fuzzy_state(state, &inferred_outputs);
            
            // Update crisp values through defuzzification
            state.crisp_frequency = Self::defuzzify_frequency(&state.frequency_membership);
            state.crisp_coordination = Self::defuzzify_coordination(&state.coordination_membership);
            state.crisp_energy_output = Self::defuzzify_energy(&state.energy_output_membership);
        }
        
        Ok(())
    }
    
    /// Convert energy endpoint to fuzzy input variables
    fn endpoint_to_fuzzy_inputs(
        &self,
        endpoint: &crate::atmospheric_energy::entropy_navigation::OptimalEnergyEndpoint,
    ) -> HashMap<String, f64> {
        let mut inputs = HashMap::new();
        
        inputs.insert("energy_demand".to_string(), endpoint.energy_demand_mw / 1000.0); // Normalize to GW
        inputs.insert("temperature".to_string(), endpoint.optimal_temperature);
        inputs.insert("pressure".to_string(), endpoint.optimal_pressure);
        inputs.insert("humidity".to_string(), endpoint.optimal_humidity);
        inputs.insert("wind_velocity".to_string(), endpoint.wind_velocity_ms);
        
        inputs
    }
    
    /// Update processor fuzzy state based on inference results
    fn update_processor_fuzzy_state(
        &self,
        state: &mut FuzzyMolecularProcessorState,
        outputs: &HashMap<String, [f64; 3]>,
    ) {
        if let Some(freq_membership) = outputs.get("frequency") {
            state.frequency_membership = *freq_membership;
        }
        
        if let Some(coord_membership) = outputs.get("coordination") {
            state.coordination_membership = *coord_membership;
        }
        
        if let Some(energy_membership) = outputs.get("energy_output") {
            state.energy_output_membership = *energy_membership;
        }
        
        if let Some(transfer_membership) = outputs.get("information_transfer") {
            state.information_transfer_membership = *transfer_membership;
        }
    }
    
    /// Defuzzify frequency membership to crisp value
    fn defuzzify_frequency(membership: &[f64; 3]) -> f64 {
        // Weighted average defuzzification
        let low_center = 1e11;
        let medium_center = 1e12;
        let high_center = 5e12;
        
        let total_weight = membership[0] + membership[1] + membership[2];
        if total_weight > 0.0 {
            (membership[0] * low_center + membership[1] * medium_center + membership[2] * high_center) / total_weight
        } else {
            medium_center // Default to medium
        }
    }
    
    /// Defuzzify coordination membership to crisp value
    fn defuzzify_coordination(membership: &[f64; 3]) -> f64 {
        // Weighted average defuzzification
        let weak_center = 0.2;
        let moderate_center = 0.5;
        let strong_center = 0.9;
        
        let total_weight = membership[0] + membership[1] + membership[2];
        if total_weight > 0.0 {
            (membership[0] * weak_center + membership[1] * moderate_center + membership[2] * strong_center) / total_weight
        } else {
            moderate_center // Default to moderate
        }
    }
    
    /// Defuzzify energy membership to crisp value
    fn defuzzify_energy(membership: &[f64; 3]) -> f64 {
        // Weighted average defuzzification
        let minimal_center = 1e-16;
        let moderate_center = 1e-13;
        let maximum_center = 1e-10;
        
        let total_weight = membership[0] + membership[1] + membership[2];
        if total_weight > 0.0 {
            (membership[0] * minimal_center + membership[1] * moderate_center + membership[2] * maximum_center) / total_weight
        } else {
            minimal_center // Default to minimal
        }
    }
    
    /// Get current fuzzy states converted to API format
    pub fn get_fuzzy_states(&self) -> crate::atmospheric_energy::molecular_processors::MolecularProcessorStates {
        let (nx, ny, nz) = self.grid_dims;
        
        let mut temperature_field = Array3::zeros((nx, ny, nz));
        let mut pressure_gradients = Array3::from_elem((nx, ny, nz), [0.0f32; 3]);
        let mut humidity_coordination = Array3::zeros((nx, ny, nz));
        let mut wind_patterns = Array3::from_elem((nx, ny, nz), [0.0f32; 3]);
        let mut oscillation_frequencies = Array3::zeros((nx, ny, nz));
        
        for ((x, y, z), state) in self.fuzzy_processor_states.indexed_iter() {
            // Convert fuzzy memberships to visualization values
            temperature_field[[x, y, z]] = state.crisp_frequency as f32 / 1e12 as f32; // Normalized frequency as temperature proxy
            humidity_coordination[[x, y, z]] = state.crisp_coordination as f32 * 100.0; // Coordination as humidity proxy
            oscillation_frequencies[[x, y, z]] = state.crisp_frequency as f32 / 1e12 as f32;
            
            // Fuzzy wind patterns based on coordination and energy
            wind_patterns[[x, y, z]] = [
                state.crisp_energy_output as f32 * 1e12 as f32,
                state.crisp_coordination as f32 * 10.0,
                state.frequency_membership[2] as f32 * 5.0, // High frequency component
            ];
            
            // Fuzzy pressure gradients based on membership distributions
            pressure_gradients[[x, y, z]] = [
                (state.coordination_membership[2] - state.coordination_membership[0]) as f32,
                (state.energy_output_membership[2] - state.energy_output_membership[0]) as f32,
                (state.frequency_membership[2] - state.frequency_membership[0]) as f32,
            ];
        }
        
        crate::atmospheric_energy::molecular_processors::MolecularProcessorStates {
            temperature_field,
            pressure_gradients,
            humidity_coordination,
            wind_patterns,
            oscillation_frequencies,
        }
    }
    
    /// Get fuzzy processor engagement percentage
    pub fn get_fuzzy_processor_engagement(&self) -> f64 {
        let total_engagement: f64 = self.fuzzy_processor_states.iter()
            .map(|state| state.crisp_coordination)
            .sum();
        
        let total_processors = self.fuzzy_processor_states.len() as f64;
        (total_engagement / total_processors) * 100.0
    }
}

impl FuzzyInferenceEngine {
    /// Perform fuzzy inference using Mamdani method
    pub fn infer(
        &self,
        inputs: &HashMap<String, f64>,
        rule_base: &FuzzyRuleBase,
        membership_functions: &AtmosphericMembershipFunctions,
    ) -> Result<HashMap<String, [f64; 3]>> {
        let mut outputs = HashMap::new();
        
        // Initialize output collections
        let mut frequency_accumulator = [0.0f64; 3];
        let mut coordination_accumulator = [0.0f64; 3];
        let mut energy_accumulator = [0.0f64; 3];
        let mut transfer_accumulator = [0.0f64; 3];
        
        // Process each rule
        for rule in &rule_base.rules {
            // Calculate rule activation strength
            let activation_strength = self.calculate_rule_activation(rule, inputs, membership_functions)?;
            
            // Apply consequents with activation strength
            for consequent in &rule.consequents {
                let output_strength = activation_strength * consequent.strength * rule.weight;
                
                match consequent.variable.as_str() {
                    "frequency" => {
                        match consequent.fuzzy_set.as_str() {
                            "low" => frequency_accumulator[0] += output_strength,
                            "medium" => frequency_accumulator[1] += output_strength,
                            "high" => frequency_accumulator[2] += output_strength,
                            _ => {},
                        }
                    },
                    "coordination" => {
                        match consequent.fuzzy_set.as_str() {
                            "weak" => coordination_accumulator[0] += output_strength,
                            "moderate" => coordination_accumulator[1] += output_strength,
                            "strong" => coordination_accumulator[2] += output_strength,
                            _ => {},
                        }
                    },
                    "energy_output" => {
                        match consequent.fuzzy_set.as_str() {
                            "minimal" => energy_accumulator[0] += output_strength,
                            "moderate" => energy_accumulator[1] += output_strength,
                            "maximum" => energy_accumulator[2] += output_strength,
                            _ => {},
                        }
                    },
                    "information_transfer" => {
                        match consequent.fuzzy_set.as_str() {
                            "slow" => transfer_accumulator[0] += output_strength,
                            "medium" => transfer_accumulator[1] += output_strength,
                            "fast" => transfer_accumulator[2] += output_strength,
                            _ => {},
                        }
                    },
                    _ => {},
                }
            }
        }
        
        // Normalize outputs
        outputs.insert("frequency".to_string(), Self::normalize_membership(frequency_accumulator));
        outputs.insert("coordination".to_string(), Self::normalize_membership(coordination_accumulator));
        outputs.insert("energy_output".to_string(), Self::normalize_membership(energy_accumulator));
        outputs.insert("information_transfer".to_string(), Self::normalize_membership(transfer_accumulator));
        
        Ok(outputs)
    }
    
    /// Calculate rule activation strength from antecedents
    fn calculate_rule_activation(
        &self,
        rule: &FuzzyRule,
        inputs: &HashMap<String, f64>,
        membership_functions: &AtmosphericMembershipFunctions,
    ) -> Result<f64> {
        let mut activation = 1.0;
        
        for (i, antecedent) in rule.antecedents.iter().enumerate() {
            if let Some(&input_value) = inputs.get(&antecedent.variable) {
                let membership_value = self.calculate_membership_value(
                    &antecedent.variable,
                    &antecedent.fuzzy_set,
                    input_value,
                    membership_functions,
                )?;
                
                if i == 0 {
                    activation = membership_value;
                } else {
                    match antecedent.operator {
                        Some(FuzzyOperator::And) => activation = activation.min(membership_value),
                        Some(FuzzyOperator::Or) => activation = activation.max(membership_value),
                        Some(FuzzyOperator::Not) => activation = activation.min(1.0 - membership_value),
                        None => activation = activation.min(membership_value), // Default to AND
                    }
                }
            }
        }
        
        Ok(activation)
    }
    
    /// Calculate membership value for a variable and fuzzy set
    fn calculate_membership_value(
        &self,
        variable: &str,
        fuzzy_set_name: &str,
        input_value: f64,
        membership_functions: &AtmosphericMembershipFunctions,
    ) -> Result<f64> {
        let fuzzy_set_collection = match variable {
            "temperature" => &membership_functions.temperature_sets,
            "pressure" => &membership_functions.pressure_sets,
            "humidity" => &membership_functions.humidity_sets,
            "frequency" => &membership_functions.frequency_sets,
            "energy_output" => &membership_functions.energy_sets,
            _ => return Ok(0.0), // Unknown variable
        };
        
        if let Some(fuzzy_set) = fuzzy_set_collection.sets.get(fuzzy_set_name) {
            Ok(Self::calculate_membership_function_value(fuzzy_set, input_value))
        } else {
            Ok(0.0) // Unknown fuzzy set
        }
    }
    
    /// Calculate membership function value
    fn calculate_membership_function_value(fuzzy_set: &FuzzySet, input: f64) -> f64 {
        match fuzzy_set.function_type {
            MembershipFunctionType::Triangular => {
                if fuzzy_set.parameters.len() >= 3 {
                    let [a, b, c] = [fuzzy_set.parameters[0], fuzzy_set.parameters[1], fuzzy_set.parameters[2]];
                    if input <= a || input >= c {
                        0.0
                    } else if input <= b {
                        (input - a) / (b - a)
                    } else {
                        (c - input) / (c - b)
                    }
                } else {
                    0.0
                }
            },
            MembershipFunctionType::Trapezoidal => {
                if fuzzy_set.parameters.len() >= 4 {
                    let [a, b, c, d] = [fuzzy_set.parameters[0], fuzzy_set.parameters[1], fuzzy_set.parameters[2], fuzzy_set.parameters[3]];
                    if input <= a || input >= d {
                        0.0
                    } else if input <= b {
                        (input - a) / (b - a)
                    } else if input <= c {
                        1.0
                    } else {
                        (d - input) / (d - c)
                    }
                } else {
                    0.0
                }
            },
            MembershipFunctionType::Gaussian => {
                if fuzzy_set.parameters.len() >= 2 {
                    let [center, width] = [fuzzy_set.parameters[0], fuzzy_set.parameters[1]];
                    (-((input - center) / width).powi(2)).exp()
                } else {
                    0.0
                }
            },
            MembershipFunctionType::Sigmoid => {
                if fuzzy_set.parameters.len() >= 2 {
                    let [center, slope] = [fuzzy_set.parameters[0], fuzzy_set.parameters[1]];
                    1.0 / (1.0 + (-slope * (input - center)).exp())
                } else {
                    0.0
                }
            },
        }
    }
    
    /// Normalize membership array
    fn normalize_membership(membership: [f64; 3]) -> [f64; 3] {
        let sum = membership[0] + membership[1] + membership[2];
        if sum > 0.0 {
            [membership[0] / sum, membership[1] / sum, membership[2] / sum]
        } else {
            [0.33, 0.34, 0.33] // Equal distribution if no activation
        }
    }
} 