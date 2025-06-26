import 'dotenv/config';
import { createClient } from '@supabase/supabase-js'
import express from 'express';
import { Client } from '@botpress/client'

const app = express();
app.use(express.json());


const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const client = new Client({
  token: 'bp_pat_unWEU4ZEaZ9qze1uYRS4GALGT8D2lbMa2MZ6',
  botId: 'bfb54e1a-3620-481f-a156-6e271d847c58',
  workspaceId: 'wkspace_01JYAGCK34QZQZTBVXVW56C0MP'
})



function normalizarTexto(texto) {
  return texto
    .normalize('NFD')                  
    .replace(/[\u0300-\u036f]/g, '')   
    .toLowerCase();                   
}



app.get('/', (req,res) =>{
  res.send('Med-IA');
});




//informacion de los doctores
const { data: doctores, error } = await supabase.from("doctores").select("id,nombre,apellido,especialidad");


const { data: doctor_hospital, error:error_doctor_hospital } = await supabase.from('doctor_hospital').select('id_doctor,id_hospital');

let { data: all_hospitales, error: hospitaless } = await supabase.from('hospitales').select('id,nombre');

let { data: citas, error:citaserror } = await supabase.from('citas').select('id_usuario,id_doctor,id_hospital,descripcion,fecha,horario')
  

let info_doctores = doctores.map(doc => {
  const hospital_ids = doctor_hospital
    .filter(dh => dh.id_doctor === doc.id)
    .map(dh => dh.id_hospital);

  const nombres_hospitales = all_hospitales
    .filter(h => hospital_ids.includes(h.id))
    .map(h => h.nombre);

  return {
    id: doc.id,
    nombre: doc.nombre,
    apellido: doc.apellido,
    especialidad: doc.especialidad,
    nombres_hospitales: nombres_hospitales
  };
});



function obtenerInfoCitasPorUsuario(userId) {
  // Filtrar citas del usuario
  const citasUsuario = citas.filter(cita => cita.id_usuario === userId);

  // Mapear y enriquecer info
  return citasUsuario.map(cita => {
    const doctor = doctores.find(doc => doc.id === cita.id_doctor) || {};
    const hospitalIds = doctor_hospital
      .filter(dh => dh.id_doctor === doctor.id)
      .map(dh => dh.id_hospital);

    const nombresHospitales = all_hospitales
      .filter(h => hospitalIds.includes(h.id))
      .map(h => h.nombre);

    return {
      id_usuario: cita.id_usuario,
      id_doctor: doctor.id,
      doctor_nombre: doctor.nombre || 'Desconocido',
      doctor_apellido: doctor.apellido || '',
      doctor_especialidad: doctor.especialidad || '',
      hospitales: nombresHospitales,
      descripcion: cita.descripcion,
      fecha: cita.fecha,
      horario: cita.horario,
    };
  });
}


app.get('/api/citasUsuario/:userId', (req, res) => {
  const userId = req.params.userId; // Aquí tomas el parámetro de la URL

  if (!userId) {
    return res.status(400).json({ error: 'Falta parámetro userId' });
  }

  const citasUsuario = obtenerInfoCitasPorUsuario(userId);

  if (citasUsuario.length === 0) {
    return res.status(404).json({ error: 'No se encontraron citas para este usuario' });
  }

  res.json({ citas: citasUsuario });
});



app.get('/api/doctores', (req,res)=>{
  res.send({ info_doctores, error });
});






//informacion de los doctores por especialidad

app.get('/api/doctores/:especialidad', (req, res) => {
  const especialidadBuscada = normalizarTexto(req.params.especialidad);

  const especialistas = doctores.filter(e =>
    normalizarTexto(e.especialidad) === especialidadBuscada
  );

  if (especialistas.length === 0) {
    return res.status(404).send('Especialistas no encontrados');
  } else {
    return res.send(especialistas);
  }
});



// Insertar citas 

app.post('/api/citas', async (req, res) => {
  try {
    // Obtener campos desde el body
    const { id_usuario, id_doctor, id_hospital, descripcion, fecha, horario } = req.body

    // Validación básica
    if (!id_usuario || !id_doctor || !id_hospital || !fecha || !horario) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Insertar cita en la base de datos
    const { data, error } = await supabase
      .from('citas')
      .insert([{
        id_usuario,
        id_doctor,
        id_hospital,
        descripcion,
        fecha,
        horario
      }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




app.delete('/api/students/:id',(req,res) =>{
  const student = students.find(c => c.id === parseInt(req.params.id))
  if (!student) return res.status(404).send('Estudiante no encontrado');
  
  const index = students.indexOf(student);
  students.splice(index,1);
  res.send(student);
});


//api para enviar el usuario a botpres

app.post('/actualizar-botpress', async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Falta userId' })
  }

  try {
    const { rows, errors } = await client.updateTableRows({
      table: 'usuarioTable',
      rows: [{ id: 1, usuario: userId }]
    })

    if (errors?.length) {
      console.error("Errores al actualizar:", errors)
      return res.status(500).json({ error: 'Error en Botpress', details: errors })
    }

    res.status(200).json({ success: true, data: rows })
  } catch (err) {
    console.error("Error general:", err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})



const port = process.env.port  || 80;
app.listen(port, ()=> console.log (`Escuchando en el puerto ${port}....`));
