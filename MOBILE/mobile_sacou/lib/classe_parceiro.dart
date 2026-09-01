class Parceiro {
  String _nomeInstituicao;
  String _bairro;
  String _cidade;
  String _estado;

 String get nomeInstituicao => _nomeInstituicao;

 set nomeInstituicao(String value) => _nomeInstituicao = value;

  String get bairro => _bairro;

 set bairro( value) => _bairro = value;

  String get cidade => _cidade;

 set cidade( value) => _cidade = value;

  String get estado => _estado;

 set estado( value) => _estado = value;


  Parceiro(this._nomeInstituicao, this._bairro, this._cidade, this._estado);
}
