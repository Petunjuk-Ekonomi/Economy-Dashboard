from flask import Flask, render_template, jsonify, request
import pandas as pd
import traceback

app = Flask(__name__)

# --- BACA DATA EXCEL ---
try:
    filepath = 'Data Justifikasi - X12 New.xlsx'
    
    # 1. Composite
    df_composite = pd.read_excel(filepath, sheet_name='X12 CENTER').fillna(0)
    df_composite['DateObj'] = pd.to_datetime(df_composite['Year:Month'], format='%b %Y', errors='coerce')
    df_composite['Parsed_Year'] = df_composite['DateObj'].dt.year.astype(str).str.replace('.0', '', regex=False)
    df_composite['Parsed_Month'] = df_composite['DateObj'].dt.strftime('%B')

    # 2. Component
    df_component = pd.read_excel(filepath, sheet_name='JUSTIFIKASI CENTER').fillna(0)
    df_component['DateObj'] = pd.to_datetime(df_component['Year:Month'], errors='coerce')
    df_component['Parsed_Year'] = df_component['DateObj'].dt.year.astype(str).str.replace('.0', '', regex=False)
    df_component['Parsed_Month'] = df_component['DateObj'].dt.strftime('%B')

    # 3. MBCC
    df_mbcc = pd.read_excel(filepath, sheet_name='MBCC CENTER').fillna(0)
    # Andaikan lajur Month adalah format datetime
    df_mbcc['Parsed_Year'] = df_mbcc['Month'].dt.year.astype(str)
    df_mbcc['Parsed_Month'] = df_mbcc['Month'].dt.strftime('%B')
except Exception as e:
    print("RALAT BACA EXCEL:", e)

# ================= ROUTING HALAMAN WEB =================
@app.route('/')
def index(): 
    return render_template('index.html') # Points to Info Page (saved as index.html)

@app.route('/composite')
def composite(): 
    return render_template('composite.html')

@app.route('/component')
def component(): 
    return render_template('component.html')

@app.route('/mbcc')
def mbcc(): 
    return render_template('mbcc.html')

# ================= API DATA =================
@app.route('/api/composite')
def get_composite():
    try:
        
        years = request.args.get('years', '').split('|')
        months = request.args.get('months', '').split('|')
        indexes = request.args.get('indexes', '').split('|')

        df = df_composite.copy()
        if years and 'All' not in years and years[0] != '': df = df[df['Parsed_Year'].isin(years)]
        if months and 'All' not in months and months[0] != '': df = df[df['Parsed_Month'].isin(months)]
        if indexes and 'All' not in indexes and indexes[0] != '': df = df[df['Index'].isin(indexes)]

        df = df.sort_values(by='DateObj')
        unique_dates = df['DateObj'].dropna().unique()
        labels = [pd.to_datetime(d).strftime('%B %Y') for d in unique_dates]
        
        colors = {'COINCIDENT INDEX': '#4A3B32', 'LAGGING INDEX': '#829368', 'LEADING INDEX': '#D4A373'}
        data = {'labels': labels, 'idx': [], 'yoy': [], 'mom': []}
        
        for idx_name in ['COINCIDENT INDEX', 'LAGGING INDEX', 'LEADING INDEX']:
            if indexes and 'All' not in indexes and indexes[0] != '' and idx_name not in indexes: continue
            idx_df = df[df['Index'] == idx_name]
            val_idx = dict(zip(idx_df['DateObj'].dt.strftime('%B %Y'), idx_df['2015=100']))
            val_yoy = dict(zip(idx_df['DateObj'].dt.strftime('%B %Y'), idx_df['YoY']))
            val_mom = dict(zip(idx_df['DateObj'].dt.strftime('%B %Y'), idx_df['MoM']))
            
            data['idx'].append({'label': idx_name, 'data': [val_idx.get(l, 0) for l in labels], 'backgroundColor': colors[idx_name]})
            data['yoy'].append({'label': idx_name, 'data': [(val_yoy.get(l, 0) / 100) for l in labels], 'borderColor': colors[idx_name]})
            data['mom'].append({'label': idx_name, 'data': [(val_mom.get(l, 0) / 100) for l in labels], 'borderColor': colors[idx_name]})

        return jsonify(data)
    except Exception as e: return jsonify({"error": str(e)}), 500


@app.route('/api/component')
def get_component():
    try:
        
        years = request.args.get('years', '').split('|')
        months = request.args.get('months', '').split('|')
        indexes = request.args.get('indexes', '').split('|')
        comps = request.args.get('components', '').split('|')

        df = df_component.copy()
        if years and 'All' not in years and years[0] != '': df = df[df['Parsed_Year'].isin(years)]
        if months and 'All' not in months and months[0] != '': df = df[df['Parsed_Month'].isin(months)]
        if indexes and 'All' not in indexes and indexes[0] != '': df = df[df['Index'].isin(indexes)]
        if comps and 'All' not in comps and comps[0] != '': df = df[df['Komponen'].isin(comps)]

        df = df.sort_values(by='DateObj')
        unique_dates = df['DateObj'].dropna().unique()
        labels = [pd.to_datetime(d).strftime('%B %Y') for d in unique_dates]
        
        data = {'labels': labels, 'idx': [], 'yoy': [], 'mom': []}
        
        for comp in df['Komponen'].unique():
            comp_df = df[df['Komponen'] == comp]
            val_idx = dict(zip(comp_df['DateObj'].dt.strftime('%B %Y'), comp_df['2015=100']))
            val_yoy = dict(zip(comp_df['DateObj'].dt.strftime('%B %Y'), comp_df['YoY']))
            val_mom = dict(zip(comp_df['DateObj'].dt.strftime('%B %Y'), comp_df['MoM']))
            
            data['idx'].append({'label': str(comp), 'data': [val_idx.get(l, 0) for l in labels]})
            data['yoy'].append({'label': str(comp), 'data': [(val_yoy.get(l, 0) / 100) for l in labels]})
            data['mom'].append({'label': str(comp), 'data': [(val_mom.get(l, 0) / 100) for l in labels]})

        return jsonify(data)
    except Exception as e: return jsonify({"error": str(e)}), 500


@app.route('/api/mbcc')
def get_mbcc():
    try:
        
        years = request.args.get('years', '').split('|')
        months = request.args.get('months', '').split('|')
        indexes = request.args.get('indexes', '').split('|')
        components = request.args.get('components', '').split('|') 

        df = df_mbcc.copy()
        
        # Penapisan Data Berdasarkan Input Pengguna
        if years and 'All' not in years and years[0] != '': 
            df = df[df['Parsed_Year'].isin(years)]
        if months and 'All' not in months and months[0] != '': 
            df = df[df['Parsed_Month'].isin(months)]
        if indexes and 'All' not in indexes and indexes[0] != '': 
            df = df[df['Composite Index'].isin(indexes)]
        if components and 'All' not in components and components[0] != '': 
            df = df[df['Component'].isin(components)]

        
        df = df.sort_values(by='Month')

        datasets = []
        for comp in df['Component'].unique():
            comp_df = df[df['Component'] == comp]
            # Hantar data titik koordinat berserta label bulannya
            points = [{'x': row['X'], 'y': row['Y'], 'month': row['Month'].strftime('%b %Y')} for _, row in comp_df.iterrows()]
            datasets.append({'label': str(comp), 'data': points})

        return jsonify({'datasets': datasets})
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)