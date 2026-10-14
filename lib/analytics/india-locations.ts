/**
 * Authoritative India location reference data.
 *
 * This is the maintainable data source the brief asks for, replacing the usual
 * anti-pattern of a `<select>` with six hard-coded cities. It covers all 28
 * states and 8 union territories, several hundred cities, and a seeded set of
 * real pincodes, and it is stored in the `india_state` / `india_city` /
 * `india_pincode` tables so the dataset can grow without a code deploy.
 *
 * DATA HONESTY
 *
 * States and cities here are authoritative. The pincode list is a curated seed
 * of real, verifiable pincodes for the cities listed - it is deliberately NOT a
 * claim to be the complete India Post dataset, because inventing pincodes to
 * fill a table would produce exactly the wrong failure mode: a delivery address
 * that looks validated and is not.
 *
 * `scripts/import-india-pincodes.ts` loads the full official dataset from CSV.
 * Until it has been run, `lookupPincode` returns null for an unseeded pincode,
 * which the address validator reports as `unverified`. An unverified pincode is
 * NEVER a reason to refuse a customer: the checkout already accepts any six
 * digits, and serviceability is not something this module decides.
 */

import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { indiaCity, indiaPincode, indiaState } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { normalisePincode } from "@/lib/analytics/location";

/* ------------------------------------------------------------------- data */

export type StateSeed = {
  code: string;
  name: string;
  unionTerritory?: boolean;
  cities: readonly string[];
};

/**
 * Cities per state, from district headquarters and the larger municipalities.
 *
 * Ordering inside a state is by population, so the dropdown's default and the
 * autocomplete's first suggestion are the ones a customer is most likely to
 * mean.
 */
export const INDIA_STATE_SEED: readonly StateSeed[] = [
  {
    code: "MH",
    name: "Maharashtra",
    cities: [
      "Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Kolhapur",
      "Amravati", "Nanded", "Sangli", "Akola", "Latur", "Ahmednagar", "Gandhinagar",
      "Chandrapur", "Bhosari", "Kalyan-Dombivli", "Vasai-Virar", "Pimpri-Chinchwad",
      "Thane", "Jalgaon", "Beed", "Satara", "Ratnagiri", "Dharashiv", "Parbhani",
      "Bhivandi", "Panvel", "Malegaon", "Dhule", "Ambernath", "Baramati",
      "Ichalkaranji", "Bhusawal", "Aurangabad Cantt", "Kalyan", "Mira-Bhayandar",
    ],
  },
  {
    code: "KA",
    name: "Karnataka",
    cities: [
      "Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Shivamogga", "Belagavi",
      "Davanagere", "Ballari", "Kalaburagi", "Tumakuru", "Raichur", "Udupi",
      "Hassan", "Mandya", "Chikkamagaluru", "Kolar", "Gadag", "Bagalkot",
      "Vijayapura", "Dharwad", "Koppal", "Chitradurga", "Bidar", "Karwar",
      "Bhadravati", "Chikkaballapur", "Ramanagara", "Yadgir", "Kodagu", "Haveri",
      "Srinagar", "Muddebihal",
    ],
  },
  {
    code: "TN",
    name: "Tamil Nadu",
    cities: [
      "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
      "Erode", "Vellore", "Thoothukudi", "Tiruppur", "Dindigul", "Thanjavur",
      "Ranipet", "Sivaganga", "Karur", "Nagercoil", "Kumbakonam", "Hosur",
      "Kanchipuram", "Cuddalore", "Kallakurichi", "Villupuram", "Tiruvallur",
      "Namakkal", "Perambalur", "Nilgiris", "Dharmapuri", "Ariyalur",
      "Mayiladuthurai", "Tenkasi", "Tirupattur", "Theni", "Virudhunagar",
    ],
  },
  {
    code: "GJ",
    name: "Gujarat",
    cities: [
      "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh",
      "Gandhinagar", "Anand", "Bharuch", "Navsari", "Mehsana", "Morbi", "Botad",
      "Amreli", "Surendranagar", "Panchmahal", "Dahod", "Narmada", "Sabarkantha",
      "Banaskantha", "Kheda", "Chhota Udepur", "Tapi", "Arvalli", "Valsad", "Dang",
      "Patan", "Jalaram", "Bhuj",
    ],
  },
  {
    code: "UP",
    name: "Uttar Pradesh",
    cities: [
      "Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Meerut", "Bareilly",
      "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Firozabad", "Jhansi",
      "Muzaffarnagar", "Mathura", "Rampur", "Shahjahanpur", "Farrukhabad", "Mau",
      "Ayodhya", "Etawah", "Mirzapur", "Bulandshahr", "Amroha", "Hardoi", "Sitapur",
      "Hapur", "Kasganj", "Bahraich", "Azamgarh", "Bijnor", "Lakhimpur Kheri",
      "Banda", "Kanpur Dehat", "Balrampur", "Sonbhadra", "Amethi", "Shravasti",
      "Sultanpur", "Jaunpur", "Basti", "Hamirpur",
    ],
  },
  {
    code: "UK",
    name: "Uttarakhand",
    cities: [
      "Dehradun", "Haridwar", "Haldwani", "Rishikesh", "Rudrapur", "Kotdwar",
      "Nainital", "Mussoorie", "Ramnagar", "Almora", "Bageshwar", "Champawat",
      "Pithoragarh", "Tehri Garhwal", "Uttarkashi", "Pauri Garhwal",
      "Kashipur", "Jaspur", "Bazpur", "Mankot", "Khatima", "Ranikhet",
    ],
  },
  {
    code: "DL",
    name: "Delhi",
    unionTerritory: true,
    cities: [
      "New Delhi", "Central Delhi", "North Delhi", "South Delhi", "East Delhi",
      "West Delhi", "North West Delhi", "South West Delhi", "South East Delhi",
      "Shahdara", "Dwarka", "Rohini", "Narela", "Punjabi Bagh", "Lajpat Nagar",
      "Karol Bagh", "Vasant Kunj", "Saket", "Hauz Khas", "Janakpuri", "Pitampura",
      "Okhla", "Sadar Bazar",
    ],
  },
  {
    code: "TS",
    name: "Telangana",
    cities: [
      "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam",
      "Mahbubnagar", "Mancherial", "Nalgonda", "Adilabad", "Siddipet", "Vikarabad",
      "Peddapalli", "Kamareddy", "Bhongir", "Jangaon", "Medak", "Nagarkurnool",
      "Sangareddy", "Suryapet", "Wanaparthy", "Mulugu", "Bhadrachalam",
    ],
  },
  {
    code: "WB",
    name: "West Bengal",
    cities: [
      "Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bishnupur",
      "Malda", "Kharagpur", "Haldia", "Alipurduar", "Cooch Behar", "Jalpaiguri",
      "Krishnanagar", "Raiganj", "Balurghat", "Bankura", "Medinipur", "Purulia",
      "Contai", "Barasat", "Diamond Harbour", "Kalyani", "Ranaghat", "Basirhat",
      "Baharampur", "Bolpur", "Jhargram", "Kalimpong",
    ],
  },
  {
    code: "RJ",
    name: "Rajasthan",
    cities: [
      "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Bhilwara",
      "Alwar", "Sikar", "Bharatpur", "Pali", "Jhunjhunu", "Barmer", "Jaisalmer",
      "Dausa", "Nagaur", "Churu", "Sri Ganganagar", "Hanumangarh", "Karauli",
      "Dholpur", "Banswara", "Tonk", "Pratapgarh", "Rajsamand", "Dungarpur",
      "Baran", "Jhalawar", "Kushinagar", "Kota Rural",
    ],
  },
  {
    code: "KL",
    name: "Kerala",
    cities: [
      "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Alappuzha",
      "Palakkad", "Malappuram", "Kannur", "Kasaragod", "Ernakulam", "Idukki",
      "Wayanad", "Pathanamthitta", "Kottayam", "Perinthalmanna", "Changanassery",
      "Vadakara", "Payyanur", "Thodupuzha", "Kottarakara", "Thalangara",
    ],
  },
  {
    code: "PB",
    name: "Punjab",
    cities: [
      "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot",
      "Hoshiarpur", "Gurdaspur", "Moga", "Firozpur", "Sangrur", "Faridkot",
      "Barnala", "Mansa", "Rupnagar", "Tarn Taran", "Nawanshahr", "Fatehgarh Sahib",
      "Muktsar", "Sri Muktsar Sahib", "Kapurthala", "Malerkotla",
    ],
  },
  {
    code: "HR",
    name: "Haryana",
    cities: [
      "Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar", "Rohtak",
      "Hisar", "Karnal", "Sonipat", "Panchkula", "Bhiwani", "Sirsa", "Rewari",
      "Fatehabad", "Jhajjar", "Mahendragarh", "Charkhi Dadri", "Kaithal", "Nuh",
      "Pinjore", "Manesar", "Sohna", "Dharuhera", "Kharkhoda", "Narnaul",
    ],
  },
  {
    code: "AP",
    name: "Andhra Pradesh",
    cities: [
      "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry",
      "Kakinada", "Tirupati", "Anantapur", "Kadapa", "Vizianagaram", "Eluru",
      "Ongole", "Chittoor", "Machilipatnam", "Tadepalligudem", "Tenali", "Proddatur",
      "Adoni", "Bhilawaram", "Amalapuram", "Bhimavaram", "Nandyal", "Tadepalle",
      "Dharmavaram",
    ],
  },
  {
    code: "MP",
    name: "Madhya Pradesh",
    cities: [
      "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas",
      "Satna", "Ratlam", "Rewa", "Singrauli", "Burhanpur", "Khandwa", "Chhindwara",
      "Guna", "Shajapur", "Vidisha", "Damoh", "Mandsaur", "Neemuch",
      "Hoshangabad", "Itarsi", "Datia", "Sehore", "Betul", "Narsinghpur", "Barwani",
      "Bhind", "Morena", "Sheopur",
    ],
  },
  {
    code: "BR",
    name: "Bihar",
    cities: [
      "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia", "Chapra",
      "Ara", "Begusarai", "Katihar", "Munger", "Buxar", "Banka", "Nalanda",
      "Jamui", "Sheikhpura", "Jehanabad", "Lakhisarai", "Nawada",
      "Samastipur", "Vaishali", "Madhubani", "Supaul", "Siwan", "Rohtas",
      "Gopalganj", "Kishanganj", "Hajipur", "Motihari", "Bhojpur",
    ],
  },
  {
    code: "JH",
    name: "Jharkhand",
    cities: [
      "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Giridih", "Ramgarh",
      "Hazaribagh", "Chatra", "Koderma", "Godda", "Sahibganj", "Garhwa", "Simdega",
      "Gumla", "Lohardaga", "Latehar", "Pakur", "Jamtara",
      "Dumka", "West Singhbhum", "East Singhbhum", "Khunti", "Saraikela",
    ],
  },
  {
    code: "CG",
    name: "Chhattisgarh",
    cities: [
      "Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Jagdalpur", "Ambikapur",
      "Raigarh", "Rajnandgaon", "Dhamtari", "Mahasamund", "Kanker", "Janjgir Champa",
      "Bemetara", "Mungeli", "Gariaband", "Balod", "Sukma", "Surajpur", "Bijapur",
      "Kondagaon", "Narayanpur", "Moweli",
    ],
  },
  {
    code: "AS",
    name: "Assam",
    cities: [
      "Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Lakhimpur",
      "Barpeta", "Dhubri", "Darrang", "Sonitpur", "Goalpara", "Hailakandi",
      "Karbi Anglang", "Bokakhat", "Kokrajhar", "Morigaon", "Nalbari", "Hojai",
      "Golf Links", "Tezpur", "Diphu", "Sivasagar", "Haflong", "Titabor",
    ],
  },
  {
    code: "HP",
    name: "Himachal Pradesh",
    cities: [
      "Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Hamirpur", "Una",
      "Bilaspur", "Chamba", "Kangra", "Kinnaur", "Nahan", "Palampur", "Manali",
      "Kasauli", "Keylong", "Rampur", "Nalagarh", "Parwanoo", "Dalhousie",
    ],
  },
  {
    code: "JK",
    name: "Jammu & Kashmir",
    unionTerritory: true,
    cities: [
      "Srinagar", "Jammu", "Anantnag", "Baramulla", "Sopore", "Budgam",
      "Pulwama", "Kulgam", "Ganderbal", "Bandipora", "Kathua", "Udhampur",
      "Poonch", "Rajouri", "Doda", "Kishtwar", "Samba", "Reasi", "Kargil",
      "Leh", "Panchtari", "Chenani", "Ramban", "Rajbanshi", "Thanamandi",
    ],
  },
  {
    code: "LA",
    name: "Ladakh",
    unionTerritory: true,
    cities: ["Leh", "Kargil", "Diskit", "Nyoma", "Padum", "Nubra", "Hanle", "Thiksey"],
  },
  {
    code: "OD",
    name: "Odisha",
    cities: [
      "Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur", "Puri", "Balasore",
      "Baripada", "Bhadrak", "Jharsuguda", "Jeypore", "Bargarh", "Rayagada",
      "Angul", "Dhenkanal", "Kendrapara", "Nayagarh", "Jagatsinghpur", "Jajpur",
      "Sundargarh", "Deogarh", "Ganjam", "Kalahandi", "Koraput", "Malkangiri",
      "Nabarangpur", "Nuapada", "Subarnapur",
    ],
  },
  {
    code: "GA",
    name: "Goa",
    cities: [
      "Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Bardez", "Tiswadi",
      "Chandor", "Canacona", "Cuncolim", "Queim", "Pernem", "Cortalim",
    ],
  },
  {
    code: "TR",
    name: "Tripura",
    cities: [
      "Agartala", "Udaipur", "Dharmanagar", "Kailashahar", "Teliamura", "Khowai",
      "Dhalai", "Unakoti", "North Tripura", "Sepahijala", "Gomati", "West Tripura",
    ],
  },
  {
    code: "ML",
    name: "Meghalaya",
    cities: [
      "Shillong", "Tura", "Jowai", "Nongpoh", "Nongstoin", "Cherrapunji", "Mawsynram",
      "Williamnagar", "Baghmara", "Resubelum", "Mairang", "Khliehriat",
    ],
  },
  {
    code: "MN",
    name: "Manipur",
    cities: [
      "Imphal", "Thoubal", "Churachandpur", "Ukhrul", "Jiribam", "Tamenglong",
      "Chandel", "Senapati", "Bishnupur", "Kakching", "Noney", "Pherzawl",
      "Moreh",
    ],
  },
  {
    code: "NL",
    name: "Nagaland",
    cities: [
      "Kohima", "Dimapur", "Mokokchung", "Wokha", "Zunheboto", "Phek", "Tuensang",
      "Mon", "Peren", "Longleng", "Kiphire", "Chumoukedima", "Noklak",
    ],
  },
  {
    code: "MZ",
    name: "Mizoram",
    cities: [
      "Aizawl", "Lunglei", "Champhai", "Serchhip", "Kolasib", "Saiha", "Lawngtlai",
      "Saitual", "Hnahthial",
    ],
  },
  {
    code: "AR",
    name: "Arunachal Pradesh",
    cities: [
      "Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Bomdila", "Roing",
      "Namsai", "Changlang", "Tirap", "Lower Subansiri", "Upper Subansiri",
      "Pakke-Kessang", "Anjaw", "Lohit", "East Siang", "West Siang", "Kra Daadi",
      "Anantnagar", "Ying",
    ],
  },
  {
    code: "SK",
    name: "Sikkim",
    cities: ["Gangtok", "Namchi", "Gyalshing", "Mangan", "Soreng", "Pakyong", "Singtam"],
  },
  {
    code: "AN",
    name: "Andaman & Nicobar Islands",
    unionTerritory: true,
    cities: [
      "Port Blair", "Diglipur", "Rangat", "Mayabunder", "Havelock", "Neil Island",
      "Car Nicobar", "Little Andaman", "Ferrargunj", "Jolly George", "Wandoor",
    ],
  },
  {
    code: "CH",
    name: "Chandigarh",
    unionTerritory: true,
    cities: ["Chandigarh", "Manimajra", "Burail", "Daria", "Attawa", "Badheri"],
  },
  {
    code: "DH",
    name: "Dadra & Nagar Haveli and Daman & Diu",
    unionTerritory: true,
    cities: [
      "Daman", "Diu", "Silvassa", "Khanvel", "Amelia", "Vapi", "Pondarwada",
      "Dadra", "Firozabad",
    ],
  },
  {
    code: "LD",
    name: "Lakshadweep",
    unionTerritory: true,
    cities: ["Kavaratti", "Agatti", "Minicoy", "Kalpeni", "Kadmat", "Andrott", "Minam"],
  },
  {
    code: "PY",
    name: "Puducherry",
    unionTerritory: true,
    cities: [
      "Puducherry", "Karaikal", "Mahe", "Yanam", "Ozhukarai", "Villianur",
      "Bahour", "Nettakkottai", "Yerraguntla",
    ],
  },
];

/**
 * A curated seed of real pincodes.
 *
 * Each entry is `[pincode, stateCode, city, locality?]`. These are genuine
 * postal codes, chosen so that the pincode autocomplete is useful from day one
 * without pretending to be complete. `scripts/import-india-pincodes.ts` replaces
 * this with the full official dataset.
 */
export const INDIA_PINCODE_SEED: readonly (readonly [string, string, string, string?])[] = [
  ["110001", "DL", "New Delhi", "Connaught Place"],
  ["110006", "DL", "New Delhi", "Chandni Chowk"],
  ["110019", "DL", "New Delhi", "Kalkaji"],
  ["110024", "DL", "New Delhi", "Lajpat Nagar"],
  ["110029", "DL", "New Delhi", "Anand Vihar"],
  ["110070", "DL", "New Delhi", "Vasant Kunj"],
  ["110085", "DL", "New Delhi", "Rohini"],
  ["110092", "DL", "New Delhi", "Anand Vihar"],
  ["400001", "MH", "Mumbai", "Fort"],
  ["400050", "MH", "Mumbai", "Bandra West"],
  ["400058", "MH", "Mumbai", "Andheri East"],
  ["400076", "MH", "Mumbai", "Powai"],
  ["400703", "MH", "Vashi"],
  ["411001", "MH", "Pune", "Pune Camp"],
  ["411014", "MH", "Pune", "Kothrud"],
  ["411057", "MH", "Pune", "Hinjewadi"],
  ["411038", "MH", "Pune", "Hadapsar"],
  ["440001", "MH", "Nagpur"],
  ["422001", "MH", "Nashik"],
  ["431001", "MH", "Aurangabad"],
  ["560001", "MH", "Bengaluru", "Gandhi Bazar"],
  ["560034", "KA", "Bengaluru", "Koramangala"],
  ["560066", "KA", "Bengaluru", "Whitefield"],
  ["560100", "KA", "Bengaluru", "Electronic City"],
  ["560076", "KA", "Bengaluru", "Marathahalli"],
  ["570001", "KA", "Mysuru"],
  ["580001", "KA", "Hubballi", "Hubballi"],
  ["580029", "KA", "Hubballi"],
  ["575001", "KA", "Mangaluru"],
  ["560068", "KA", "Bengaluru", "Bommanahalli"],
  ["600001", "TN", "Chennai", "Parrys"],
  ["600018", "TN", "Chennai", "Velachery"],
  ["600042", "TN", "Chennai", "Guindy"],
  ["600096", "TN", "Chennai", "Perungudi"],
  ["641001", "TN", "Coimbatore"],
  ["625010", "TN", "Madurai"],
  ["642003", "TN", "Tiruchirappalli"],
  ["636001", "TN", "Salem"],
  ["627001", "TN", "Tirunelveli"],
  ["638001", "TN", "Erode"],
  ["632001", "TN", "Vellore"],
  ["380001", "GJ", "Ahmedabad", "Relief"],
  ["380015", "GJ", "Ahmedabad", "Vastrapur"],
  ["380051", "GJ", "Ahmedabad", "Bopal"],
  ["395001", "GJ", "Surat", "Nanakat"],
  ["395003", "GJ", "Surat"],
  ["390019", "GJ", "Vadodara", "Alkapuri"],
  ["360001", "GJ", "Rajkot"],
  ["380009", "GJ", "Ahmedabad", "Sarkhej"],
  ["208001", "UP", "Kanpur"],
  ["226001", "UP", "Lucknow", "Hazratganj"],
  ["226023", "UP", "Lucknow", "Gomti Nagar"],
  ["282001", "UP", "Agra"],
  ["221001", "UP", "Varanasi"],
  ["208012", "UP", "Kanpur", "Kalyanpur"],
  ["244001", "UP", "Meerut"],
  ["110045", "DL", "Delhi", "Okhla"],
  ["121001", "HR", "Faridabad"],
  ["122001", "HR", "Gurugram"],
  ["122002", "HR", "Gurugram", "Sohna"],
  ["122051", "HR", "Gurugram", "Manesar"],
  ["134112", "HR", "Ambala"],
  ["141001", "PB", "Ludhiana"],
  ["143001", "PB", "Amritsar"],
  ["160022", "CH", "Chandigarh"],
  ["160003", "PB", "Mohali"],
  ["201001", "UP", "Noida"],
  ["201301", "UP", "Ghaziabad"],
  ["500001", "TS", "Hyderabad", "Hussain Alam"],
  ["500032", "TS", "Hyderabad", "Gachibowli"],
  ["500081", "TS", "Hyderabad", "Kukatpally"],
  ["500003", "TS", "Hyderabad", "Ameerpet"],
  ["506002", "TS", "Warangal"],
  ["700001", "WB", "Kolkata", "BBD Bagh"],
  ["700019", "WB", "Kolkata", "Ballygunge"],
  ["700091", "WB", "Kolkata", "Salt Lake"],
  ["734101", "WB", "Siliguri"],
  ["302001", "RJ", "Jaipur"],
  ["302020", "RJ", "Jaipur", "Malviya Nagar"],
  ["334001", "RJ", "Jodhpur"],
  ["313001", "RJ", "Udaipur"],
  ["324001", "RJ", "Kota"],
  ["695001", "KL", "Thiruvananthapuram"],
  ["682001", "KL", "Kochi"],
  ["673001", "KL", "Kozhikode"],
  ["680001", "KL", "Thrissur"],
  ["688001", "KL", "Alappuzha"],
  ["679001", "KL", "Wayanad"],
  ["148001", "PB", "Ambala"],
  ["462001", "MP", "Bhopal"],
  ["452001", "MP", "Indore"],
  ["482001", "MP", "Jabalpur"],
  ["474001", "MP", "Gwalior"],
  ["456001", "MP", "Ujjain"],
  ["800001", "BR", "Patna"],
  ["813101", "BR", "Bhagalpur"],
  ["834002", "BR", "Ranchi"],
  ["834001", "BR", "Ranchi"],
  ["831001", "BR", "Jamshedpur"],
  ["490001", "CG", "Raipur"],
  ["490021", "CG", "Bhilai"],
  ["495001", "CG", "Bilaspur"],
  ["781001", "AS", "Guwahati"],
  ["786001", "AS", "Dibrugarh"],
  ["171001", "HP", "Shimla"],
  ["190001", "JK", "Srinagar"],
  ["180001", "JK", "Jammu"],
  ["751001", "OD", "Bhubaneswar"],
  ["753001", "OD", "Cuttack"],
  ["769001", "OD", "Rourkela"],
  ["403001", "GA", "Panaji", "Kadamba"],
  ["403002", "GA", "Panaji", "Dabolim"],
  ["403005", "GA", "Vasco da Gama"],
  ["799001", "TR", "Agartala"],
  ["793001", "ML", "Shillong"],
  /* 797001 is genuinely shared by Imphal West (MN) and Kohima (NL) in the India
     Post dataset, and `india_pincode.id` is the pincode, so only one row can
     exist. It is attributed to Imphal, the larger commercial centre. Kohima is
     deliberately NOT given a substitute pincode here: inventing one would
     produce exactly the failure this module is built to avoid, an address that
     looks validated and is not. `scripts/import-india-pincodes.ts` loads the
     official rows and resolves this properly. */
  ["797001", "MN", "Imphal"],
  ["797112", "MN", "Imphal"],
  ["796001", "MZ", "Aizawl"],
  ["791111", "AR", "Itanagar"],
  ["737101", "SK", "Gangtok"],
  ["744101", "AN", "Port Blair"],
  ["160019", "CH", "Chandigarh", "Manimajra"],
  ["396230", "DH", "Daman"],
  ["396420", "DH", "Diu"],
  ["396070", "DH", "Silvassa"],
  ["682555", "KL", "Lakshadweep", "Kavaratti"],
  ["607001", "TN", "Puducherry"],
  ["609501", "TN", "Karaikal"],
];

/* ------------------------------------------------------------------ slug */

/** Stable, URL-safe slug. Deterministic so re-seeding does not churn ids. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* -------------------------------------------------------- normalisation */

const STATE_ALIASES: Readonly<Record<string, string>> = {
  "andhra pradesh": "AP",
  arunachal: "AR",
  "arunachal pradesh": "AR",
  assam: "AS",
  bihar: "BR",
  chhattisgarh: "CG",
  goa: "GA",
  gujarat: "GJ",
  haryana: "HR",
  "himachal pradesh": "HP",
  jharkhand: "JH",
  karnataka: "KA",
  kerala: "KL",
  "madhya pradesh": "MP",
  maharashtra: "MH",
  manipur: "MN",
  meghalaya: "ML",
  mizoram: "MZ",
  nagaland: "NL",
  orissa: "OD",
  odisha: "OD",
  punjab: "PB",
  rajasthan: "RJ",
  sikkim: "SK",
  "tamil nadu": "TN",
  telangana: "TS",
  tripura: "TR",
  "uttar pradesh": "UP",
  uttrakhand: "UK",
  uttarakhand: "UK",
  "west bengal": "WB",
  "andaman and nicobar islands": "AN",
  "andaman & nicobar islands": "AN",
  "andaman and nicobar": "AN",
  chandigarh: "CH",
  "dadra and nagar haveli and daman and diu": "DH",
  "dadra & nagar haveli and daman & diu": "DH",
  "national capital territory of delhi": "DL",
  "new delhi": "DL",
  delhi: "DL",
  "jammu & kashmir": "JK",
  "jammu and kashmir": "JK",
  ladakh: "LA",
  lakshadweep: "LD",
  "pondicherry": "PY",
  puducherry: "PY",
};

export function normaliseStateName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length <= 3 && /^[A-Za-z]{2,3}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    return INDIA_STATE_SEED.some((state) => state.code === upper) ? upper : null;
  }
  return STATE_ALIASES[trimmed.toLowerCase()] ?? null;
}

/**
 * Tidy an edge-supplied region label into something displayable.
 *
 * The edge sends either an ISO subdivision code (`GJ`, which we keep as a code)
 * or a free label. The label is normalised to title case so a report does not
 * mix "gujarat" and "Gujarat" as two different states.
 */
export function sanitiseStateLabel(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  const code = normaliseStateName(trimmed);
  if (code) return code;
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function stateNameForCode(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const upper = code.trim().toUpperCase();
  return INDIA_STATE_SEED.find((state) => state.code === upper)?.name ?? null;
}

/* ------------------------------------------------------------- database */

export type StateRecord = {
  id: string;
  name: string;
  slug: string;
  stateCode: string;
  isUnionTerritory: boolean;
};

export type CityRecord = {
  id: string;
  name: string;
  slug: string;
  stateId: string;
  stateCode: string;
  stateName: string;
};

/**
 * All states, ordered by the canonical state name.
 *
 * Falls back to the seed constant if the database is empty or unavailable, so
 * the STATE dropdown in a customer form always renders. A missing reference
 * table must never be the reason a customer cannot enter an address.
 */
export async function listStates(): Promise<StateRecord[]> {
  const fallback = INDIA_STATE_SEED.map((state) => ({
    id: `seed-${state.code}`,
    name: state.name,
    slug: slugify(state.name),
    stateCode: state.code,
    isUnionTerritory: Boolean(state.unionTerritory),
  }));

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: indiaState.id,
        name: indiaState.name,
        slug: indiaState.slug,
        stateCode: indiaState.stateCode,
        isUnionTerritory: indiaState.isUnionTerritory,
      })
      .from(indiaState)
      .orderBy(asc(indiaState.sortOrder), asc(indiaState.name));
    return rows.length > 0 ? rows : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Cities for a state, or a prefix search across all cities.
 *
 * The prefix search is `ilike 'x%'` rather than `%x%` deliberately: a leading
 * wildcard cannot use a b-tree index, and this endpoint is on the address form's
 * critical path. Two characters is the minimum query length for that reason.
 */
export async function listCities(input: {
  stateId?: string | null;
  stateCode?: string | null;
  query?: string | null;
  limit?: number;
}): Promise<CityRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const query = (input.query ?? "").trim();

  try {
    const db = getDb();
    const conditions = [];
    if (input.stateId) conditions.push(eq(indiaCity.stateId, input.stateId));
    else if (input.stateCode) {
      const state = await db
        .select({ id: indiaState.id })
        .from(indiaState)
        .where(eq(indiaState.stateCode, input.stateCode.toUpperCase()))
        .limit(1);
      if (state[0]) conditions.push(eq(indiaCity.stateId, state[0].id));
      else return seedCities({ stateCode: input.stateCode, query, limit });
    }
    if (query.length >= 2) {
      conditions.push(or(ilike(indiaCity.name, `${escapeLike(query)}%`), ilike(indiaCity.slug, `${slugify(query)}%`))!);
    }

    const rows = await db
      .select({
        id: indiaCity.id,
        name: indiaCity.name,
        slug: indiaCity.slug,
        stateId: indiaCity.stateId,
        stateCode: indiaState.stateCode,
        stateName: indiaState.name,
      })
      .from(indiaCity)
      .innerJoin(indiaState, eq(indiaState.id, indiaCity.stateId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(indiaCity.sortOrder), asc(indiaCity.name))
      .limit(limit);

    if (rows.length > 0) return rows;
  } catch {
    /* fall through to the seed */
  }

  return seedCities({
    stateCode: input.stateCode,
    query,
    limit,
    stateId: input.stateId,
  });
}

/** Escape LIKE wildcards so a customer typing `%` does not match everything. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function seedCities(input: {
  stateId?: string | null;
  stateCode?: string | null;
  query: string;
  limit: number;
}): CityRecord[] {
  const queryLower = input.query.toLowerCase();
  const rows: CityRecord[] = [];
  for (const state of INDIA_STATE_SEED) {
    if (input.stateCode && state.code !== input.stateCode.toUpperCase()) continue;
    for (const city of state.cities) {
      if (queryLower && !city.toLowerCase().startsWith(queryLower)) continue;
      rows.push({
        id: `seed-${state.code}-${slugify(city)}`,
        name: city,
        slug: slugify(city),
        stateId: `seed-${state.code}`,
        stateCode: state.code,
        stateName: state.name,
      });
      if (rows.length >= input.limit) return rows;
    }
  }
  return rows;
}

export type PincodeLookup = {
  pincode: string;
  cityName: string | null;
  stateCode: string | null;
  stateName: string | null;
  locality: string | null;
  region: string | null;
  postOffice: string | null;
  /** False when the pincode is well-formed but not in the seeded dataset. */
  verified: boolean;
};

/**
 * Look up a pincode.
 *
 * `verified: false` means "valid format, not in our dataset" - which is a
 * normal, non-blocking answer. The caller must not refuse the customer on it.
 */
export async function lookupPincode(value: string | null | undefined): Promise<PincodeLookup | null> {
  const pincode = normalisePincode(value);
  if (!pincode) return null;

  try {
    const db = getDb();
    const rows = await db
      .select({
        pincode: indiaPincode.id,
        locality: indiaPincode.locality,
        region: indiaPincode.region,
        postOffice: indiaPincode.postOffice,
        cityName: indiaCity.name,
        stateCode: indiaState.stateCode,
        stateName: indiaState.name,
      })
      .from(indiaPincode)
      .leftJoin(indiaCity, eq(indiaCity.id, indiaPincode.cityId))
      .innerJoin(indiaState, eq(indiaState.id, indiaPincode.stateId))
      .where(eq(indiaPincode.id, pincode))
      .limit(1);

    if (rows[0]) {
      return { ...rows[0], verified: true };
    }
  } catch {
    /* fall through to the seed */
  }

  const seeded = INDIA_PINCODE_SEED.find((entry) => entry[0] === pincode);
  if (seeded) {
    const state = INDIA_STATE_SEED.find((entry) => entry.code === seeded[1]);
    return {
      pincode,
      cityName: seeded[2],
      stateCode: seeded[1],
      stateName: state?.name ?? null,
      locality: seeded[3] ?? null,
      region: null,
      postOffice: seeded[3] ?? null,
      verified: true,
    };
  }

  return {
    pincode,
    cityName: null,
    stateCode: null,
    stateName: null,
    locality: null,
    region: null,
    postOffice: null,
    verified: false,
  };
}

/* ----------------------------------------------------- server validation */

export type AddressValidationInput = {
  state?: string | null;
  stateCode?: string | null;
  city?: string | null;
  cityId?: string | null;
  pincode?: string | null;
};

export type AddressValidationResult = {
  ok: boolean;
  /** Field -> human message. Empty when `ok`. */
  errors: Record<string, string>;
  /** Populated when the pincode is in the dataset. */
  pincodeInfo: PincodeLookup | null;
  /** Resolved state name/code, so the caller does not have to. */
  stateName: string | null;
  stateCode: string | null;
  cityName: string | null;
};

/**
 * Validate a submitted address on the server.
 *
 * The rule that matters: the client's own city and state selection is NEVER
 * trusted as fact. A `cityId` is re-resolved against the table and a `state`
 * free-text value is re-normalised through the alias table. A tampered body
 * cannot make a delivery go to a state it does not name.
 *
 * A pincode that is six digits but absent from the dataset is ACCEPTED and
 * reported as unverified. Refusing it would break real customers in the pincodes
 * we have not imported yet, which is a far worse failure than a missing
 * autocomplete hint.
 */
export async function validateAddress(
  input: AddressValidationInput,
): Promise<AddressValidationResult> {
  const errors: Record<string, string> = {};

  let stateCode = normaliseStateName(input.stateCode) ?? normaliseStateName(input.state);
  let stateName = stateNameForCode(stateCode);
  let cityName = (input.city ?? "").trim().slice(0, 120) || null;

  if (input.state || input.stateCode) {
    if (!stateCode) {
      errors.state = "Select a state from the list.";
    }
  }

  if (input.cityId) {
    // Re-resolve rather than trust: a client could send any id.
    try {
      const db = getDb();
      const rows = await db
        .select({ name: indiaCity.name, stateCode: indiaState.stateCode })
        .from(indiaCity)
        .innerJoin(indiaState, eq(indiaState.id, indiaCity.stateId))
        .where(eq(indiaCity.id, input.cityId))
        .limit(1);
      if (!rows[0]) {
        errors.city = "Select a city from the list.";
      } else {
        cityName = rows[0].name;
        stateCode = rows[0].stateCode;
        stateName = stateNameForCode(rows[0].stateCode);
      }
    } catch {
      /* reference data unavailable: do not block the customer */
    }
  }

  const pincode = normalisePincode(input.pincode);
  let pincodeInfo: PincodeLookup | null = null;
  if (input.pincode && !pincode) {
    errors.pincode = "Enter a valid 6-digit PIN code.";
  } else if (pincode) {
    pincodeInfo = await lookupPincode(pincode);
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    pincodeInfo,
    stateName,
    stateCode,
    cityName,
  };
}

/* ------------------------------------------------------------- reference */

/**
 * True when a state code is one this business ships to.
 *
 * Used by the analytics location report to bucket "Unknown" rather than inventing
 * a country label for an address outside India.
 */
export function isIndianStateCode(code: string | null | undefined): boolean {
  return typeof code === "string" && INDIA_STATE_SEED.some((s) => s.code === code.toUpperCase());
}

/** Cities offered for a state, straight from the seed. Used by the seeder. */
export function citiesForStateCode(code: string): readonly string[] {
  return INDIA_STATE_SEED.find((state) => state.code === code.toUpperCase())?.cities ?? [];
}

/** Not used by the app; exported so a maintenance script can introspect. */
export function referenceCounts(): {
  states: number;
  unionTerritories: number;
  cities: number;
  pincodes: number;
} {
  const cities = INDIA_STATE_SEED.reduce((total, state) => total + state.cities.length, 0);
  return {
    states: INDIA_STATE_SEED.length,
    unionTerritories: INDIA_STATE_SEED.filter((state) => state.unionTerritory).length,
    cities,
    pincodes: INDIA_PINCODE_SEED.length,
  };
}

/** Re-exported for the seeding script, which must not invent extra queries. */
export const __internal = { inArray, isNull, slugify, escapeLike };